"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePicker from "@/components/ui/date-picker";
import PlanTaskRow from "@/components/travel/plan-task-row";
import PlanSegmentTabs, { type Segment } from "@/components/travel/plan-segment-tabs";
import PlanLegCard from "@/components/travel/plan-leg-card";
import PlanRouteMap from "@/components/travel/plan-route-map";
import { useTravelPlans } from "@/hooks/use-travel-plans";
import { useTravelPlanTasks } from "@/hooks/use-travel-plan-tasks";
import { sortTasks } from "@/lib/travel/sort-tasks";
import { tasksToLegs } from "@/lib/travel/legs";
import { fetchRouteDuration } from "@/lib/travel/providers";
import type { TravelPlanTask, TransportMode } from "@/types";

interface Props {
  planId: string;
  onBack: () => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(startIso: string, endIso: string): number {
  const s = new Date(startIso + "T00:00:00");
  const e = new Date(endIso + "T00:00:00");
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000));
}

export default function PlanDetail({ planId, onBack }: Props) {
  const { plans, updatePlan } = useTravelPlans();
  const plan = plans.find((p) => p.id === planId);
  const { tasks, addTask, updateTask, deleteTask } = useTravelPlanTasks(planId);

  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment>({ mode: "all" });
  const [legPaths, setLegPaths] = useState<Record<string, [number, number][]>>({});

  const sorted = useMemo(() => sortTasks(tasks), [tasks]);
  const legs = useMemo(() => tasksToLegs(sorted), [sorted]);
  const legsWithCoords = useMemo(
    () =>
      legs.filter(
        (l) =>
          l.fromTask.place_lat != null &&
          l.fromTask.place_lng != null &&
          l.toTask.place_lat != null &&
          l.toTask.place_lng != null
      ),
    [legs]
  );
  const days = useMemo(() => {
    const set = new Set<number>();
    for (const t of sorted) set.add(t.day_index);
    // 존재하지 않아도 start_date~end_date 범위의 day_index 도 포함
    if (plan?.start_date && plan?.end_date) {
      const total = daysBetween(plan.start_date, plan.end_date);
      for (let i = 0; i <= total; i++) set.add(i);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [sorted, plan?.start_date, plan?.end_date]);

  // day_index → 표시 라벨 ("1일차" 또는 "5/10 (월)")
  const formatDayLabel = (dayIndex: number): string => {
    if (plan?.start_date) {
      const iso = addDaysISO(plan.start_date, dayIndex);
      const d = new Date(iso + "T00:00:00");
      return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
    }
    return `${dayIndex + 1}일차`;
  };

  const totalDays = plan?.start_date && plan?.end_date
    ? daysBetween(plan.start_date, plan.end_date) + 1
    : 0;

  // 지도 핀 + 경로 필터
  const { pins, path, connectPins } = useMemo(() => {
    const taskToPin = (t: TravelPlanTask) =>
      t.place_lat != null && t.place_lng != null
        ? { lat: t.place_lat, lng: t.place_lng, label: t.place_name }
        : null;

    if (segment.mode === "all") {
      const all = sorted.map(taskToPin).filter(Boolean) as {
        lat: number; lng: number; label: string;
      }[];
      return { pins: all, path: undefined, connectPins: all.length > 1 };
    }
    if (segment.mode === "day") {
      const dayTasks = sorted.filter((t) => t.day_index === segment.dayIndex);
      const dayPins = dayTasks.map(taskToPin).filter(Boolean) as {
        lat: number; lng: number; label: string;
      }[];
      return { pins: dayPins, path: undefined, connectPins: dayPins.length > 1 };
    }
    // leg 모드
    const leg = legsWithCoords[segment.legIndex];
    if (!leg) return { pins: [], path: undefined, connectPins: false };
    const legKey = `${leg.fromTaskId}-${leg.toTaskId}`;
    const pts = [taskToPin(leg.fromTask), taskToPin(leg.toTask)].filter(Boolean) as {
      lat: number; lng: number; label: string;
    }[];
    return { pins: pts, path: legPaths[legKey], connectPins: !legPaths[legKey] };
  }, [segment, sorted, legsWithCoords, legPaths]);

  const ensureLegPath = async (legIndex: number) => {
    const leg = legsWithCoords[legIndex];
    if (!leg) return;
    const key = `${leg.fromTaskId}-${leg.toTaskId}`;
    if (legPaths[key]) return;
    const mode: TransportMode = leg.toTask.transport_mode ?? "car";
    if (mode !== "car" && mode !== "taxi") return;
    const result = await fetchRouteDuration(
      { lat: leg.fromTask.place_lat!, lng: leg.fromTask.place_lng! },
      { lat: leg.toTask.place_lat!, lng: leg.toTask.place_lng! },
      mode
    );
    if (result?.path && result.path.length > 1) {
      setLegPaths((p) => ({ ...p, [key]: result.path! }));
    }
  };

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">계획을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const handleAddRow = async (day_index = 0) => {
    await addTask({
      plan_id: planId,
      day_index,
      start_time: null,
      place_name: "",
      place_address: null,
      place_lat: null,
      place_lng: null,
      tag: null,
      content: null,
      stay_minutes: 0,
      manual_order: tasks.filter((t) => t.day_index === day_index).length,
      transport_mode: null,
      transport_duration_sec: null,
      transport_manual: false,
    });
  };

  // "새 일자" 선택 시 next day_index 반환
  const handleAddNewDay = (): number => {
    const max = Math.max(-1, ...days);
    return max + 1;
  };

  const handleTitleCommit = async () => {
    if (titleDraft == null) return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== plan.title) {
      await updatePlan(plan.id, { title: trimmed });
    }
    setTitleDraft(null);
  };

  // 테이블 — 정렬된 task 사이에 leg 카드 삽입
  const rowsWithLegs: React.ReactNode[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    rowsWithLegs.push(
      <PlanTaskRow
        key={t.id}
        task={t}
        onChange={(updates) => updateTask(t.id, updates)}
        onDelete={() => deleteTask(t.id)}
        availableDays={days}
        onAddNewDay={handleAddNewDay}
        formatDayLabel={formatDayLabel}
      />
    );
    const next = sorted[i + 1];
    if (next && next.day_index === t.day_index) {
      const hasCoords =
        t.place_lat != null && t.place_lng != null &&
        next.place_lat != null && next.place_lng != null;
      if (hasCoords) {
        const legForThisPair = legsWithCoords.find(
          (l) => l.fromTaskId === t.id && l.toTaskId === next.id
        );
        if (legForThisPair) {
          rowsWithLegs.push(
            <PlanLegCard
              key={`leg-${t.id}-${next.id}`}
              leg={legForThisPair}
              onUpdateTask={updateTask}
            />
          );
        }
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <header className="flex items-center gap-2 border-b px-3 h-14 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground -ml-1"
          aria-label="계획 목록으로"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {titleDraft != null ? (
          <Input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleCommit();
              if (e.key === "Escape") setTitleDraft(null);
            }}
            className="h-9 flex-1 text-base font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={() => setTitleDraft(plan.title)}
            className="flex-1 text-left text-base font-semibold truncate hover:text-muted-foreground"
          >
            {plan.title}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* 기간 행 — 캘린더 event-form 과 동일한 DatePicker */}
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <span className="text-xs text-muted-foreground shrink-0">기간</span>
          <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1 flex-1 min-w-0">
            <DatePicker
              value={plan.start_date ?? ""}
              onChange={(v) => updatePlan(plan.id, { start_date: v || null })}
              className="h-8 min-w-0 text-xs"
            />
            <span className="text-xs text-muted-foreground">~</span>
            <DatePicker
              value={plan.end_date ?? ""}
              onChange={(v) => updatePlan(plan.id, { end_date: v || null })}
              min={plan.start_date ?? undefined}
              className="h-8 min-w-0 text-xs"
            />
            {plan.end_date ? (
              <button
                type="button"
                onClick={() => updatePlan(plan.id, { end_date: null })}
                className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
                aria-label="종료일 제거"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="w-4" />
            )}
          </div>
          {totalDays > 0 && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {totalDays - 1}박 {totalDays}일
            </span>
          )}
        </div>

        {/* 경로맵 */}
        <div className="flex flex-col gap-2 p-3 border-b">
          <PlanSegmentTabs
            segment={segment}
            onChange={(s) => {
              setSegment(s);
              if (s.mode === "leg") ensureLegPath(s.legIndex);
            }}
            days={days}
            legs={legsWithCoords}
          />
          <PlanRouteMap
            pins={pins}
            path={path}
            connectPins={connectPins}
            height={240}
          />
        </div>

        {/* 테이블 + leg 카드 */}
        <div className="flex flex-col gap-2 p-3">
          {rowsWithLegs}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAddRow(0)}
            className="self-start h-8 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> 새 일정
          </Button>
        </div>
      </div>
    </div>
  );
}

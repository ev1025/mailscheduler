"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function PlanDetail({ planId, onBack }: Props) {
  const { plans, updatePlan } = useTravelPlans();
  const plan = plans.find((p) => p.id === planId);
  const { tasks, addTask, updateTask, deleteTask } = useTravelPlanTasks(planId);

  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment>({ mode: "all" });
  // 경로별 뷰에서 자가용 path 캐시 (leg index 기준)
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
    return Array.from(set).sort((a, b) => a - b);
  }, [sorted]);

  // 지도에 표시할 핀 필터
  const { pins, path } = useMemo(() => {
    const taskToPin = (t: TravelPlanTask) =>
      t.place_lat != null && t.place_lng != null
        ? { lat: t.place_lat, lng: t.place_lng, label: t.place_name }
        : null;

    if (segment.mode === "all") {
      const all = sorted.map(taskToPin).filter(Boolean) as {
        lat: number; lng: number; label: string;
      }[];
      return { pins: all, path: undefined };
    }
    if (segment.mode === "day") {
      const dayTasks = sorted.filter((t) => t.day_index === segment.dayIndex);
      const dayPins = dayTasks.map(taskToPin).filter(Boolean) as {
        lat: number; lng: number; label: string;
      }[];
      return { pins: dayPins, path: undefined };
    }
    // leg 모드
    const leg = legsWithCoords[segment.legIndex];
    if (!leg) return { pins: [], path: undefined };
    const legKey = `${leg.fromTaskId}-${leg.toTaskId}`;
    const pts = [taskToPin(leg.fromTask), taskToPin(leg.toTask)].filter(Boolean) as {
      lat: number; lng: number; label: string;
    }[];
    return { pins: pts, path: legPaths[legKey] };
  }, [segment, sorted, legsWithCoords, legPaths]);

  // 경로별 뷰로 진입하면 자가용 경로 path 요청 (캐시 없을 때)
  const ensureLegPath = async (legIndex: number) => {
    const leg = legsWithCoords[legIndex];
    if (!leg) return;
    const key = `${leg.fromTaskId}-${leg.toTaskId}`;
    if (legPaths[key]) return;
    const mode: TransportMode = leg.toTask.transport_mode ?? "car";
    if (mode !== "car" && mode !== "taxi") return; // 대중교통 path 는 MVP 에서 미사용
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

  const handleTitleCommit = async () => {
    if (titleDraft == null) return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== plan.title) {
      await updatePlan(plan.id, { title: trimmed });
    }
    setTitleDraft(null);
  };

  // 테이블 행 단위 렌더링: 정렬된 task 사이에 leg 카드 끼워넣기
  const rowsWithLegs: React.ReactNode[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    rowsWithLegs.push(
      <PlanTaskRow
        key={t.id}
        task={t}
        onChange={(updates) => updateTask(t.id, updates)}
        onDelete={() => deleteTask(t.id)}
      />
    );
    // 다음 task 가 같은 day 이고 좌표 모두 있으면 leg 카드 삽입
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
        {/* 경로맵 섹션 */}
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
          <PlanRouteMap pins={pins} path={path} height={240} />
        </div>

        {/* 일정 테이블 + leg 카드 */}
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

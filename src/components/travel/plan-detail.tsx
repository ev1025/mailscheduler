"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePicker from "@/components/ui/date-picker";
import PlanTaskRow from "@/components/travel/plan-task-row";
import PlanTaskSheet from "@/components/travel/plan-task-sheet";
import PlanSegmentTabs, { type Segment } from "@/components/travel/plan-segment-tabs";
import PlanLegCard from "@/components/travel/plan-leg-card";
import PlanRouteMap from "@/components/travel/plan-route-map";
import { useTravelPlans } from "@/hooks/use-travel-plans";
import { useTravelPlanTasks } from "@/hooks/use-travel-plan-tasks";
import { sortTasks } from "@/lib/travel/sort-tasks";
import { tasksToLegs } from "@/lib/travel/legs";
import { fetchRouteDuration } from "@/lib/travel/providers";
import { computeExpectedTimes } from "@/lib/travel/expected-time";
import type { TravelPlanTask, TransportMode } from "@/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

// 개별 task 행 — DnD 연동용 래퍼
function SortableTaskRow({
  task,
  onClick,
  onDelete,
  expectedTime,
}: {
  task: TravelPlanTask;
  onClick: () => void;
  onDelete: () => void;
  expectedTime?: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <PlanTaskRow
        task={task}
        onClick={onClick}
        onDelete={onDelete}
        expectedTime={expectedTime}
        dragListeners={listeners as unknown as React.HTMLAttributes<HTMLButtonElement>}
        dragAttributes={attributes as unknown as React.HTMLAttributes<HTMLButtonElement>}
      />
    </div>
  );
}

export default function PlanDetail({ planId, onBack }: Props) {
  const { plans, updatePlan } = useTravelPlans();
  const plan = plans.find((p) => p.id === planId);
  const { tasks, addTask, updateTask, deleteTask } = useTravelPlanTasks(planId);

  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment>({ mode: "all" });
  const [legPaths, setLegPaths] = useState<Record<string, [number, number][]>>({});

  // 시트 상태: 편집 중이면 task, 신규면 null + 대상 day_index
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTask, setSheetTask] = useState<TravelPlanTask | null>(null);
  const [sheetDayIndex, setSheetDayIndex] = useState(0);

  const sorted = useMemo(() => sortTasks(tasks), [tasks]);
  // 출발지 시간 + 체류 + 이동시간 → 도착지 예상 시간 맵
  const expectedTimes = useMemo(() => computeExpectedTimes(sorted), [sorted]);
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
    if (plan?.start_date && plan?.end_date) {
      const total = daysBetween(plan.start_date, plan.end_date);
      for (let i = 0; i <= total; i++) set.add(i);
    }
    if (set.size === 0) set.add(0);
    return Array.from(set).sort((a, b) => a - b);
  }, [sorted, plan?.start_date, plan?.end_date]);

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

  const visibleLegs = useMemo(() => {
    if (segment.mode === "all") return legsWithCoords;
    if (segment.mode === "day") {
      return legsWithCoords.filter((l) => l.dayIndex === segment.dayIndex);
    }
    const one = legsWithCoords[segment.legIndex];
    return one ? [one] : [];
  }, [segment, legsWithCoords]);

  // 보이는 leg 자동 path fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const leg of visibleLegs) {
        if (cancelled) return;
        const key = `${leg.fromTaskId}-${leg.toTaskId}`;
        if (legPaths[key]) continue;
        const mode: TransportMode = leg.toTask.transport_mode ?? "car";
        if (mode !== "car" && mode !== "taxi") continue;
        const result = await fetchRouteDuration(
          { lat: leg.fromTask.place_lat!, lng: leg.fromTask.place_lng! },
          { lat: leg.toTask.place_lat!, lng: leg.toTask.place_lng! },
          mode
        );
        if (cancelled) return;
        if (result?.path && result.path.length > 1) {
          setLegPaths((p) => ({ ...p, [key]: result.path! }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [visibleLegs, legPaths]);

  const { pins, paths, connectPins } = useMemo(() => {
    const taskToPin = (t: TravelPlanTask) =>
      t.place_lat != null && t.place_lng != null
        ? { lat: t.place_lat, lng: t.place_lng, label: t.place_name }
        : null;

    let shownTasks: TravelPlanTask[];
    if (segment.mode === "all") shownTasks = sorted;
    else if (segment.mode === "day")
      shownTasks = sorted.filter((t) => t.day_index === segment.dayIndex);
    else {
      const leg = legsWithCoords[segment.legIndex];
      shownTasks = leg ? [leg.fromTask, leg.toTask] : [];
    }
    const shownPins = shownTasks.map(taskToPin).filter(Boolean) as {
      lat: number; lng: number; label: string;
    }[];

    const shownPaths = visibleLegs
      .map((l) => legPaths[`${l.fromTaskId}-${l.toTaskId}`])
      .filter((p): p is [number, number][] => !!p && p.length > 1);

    return {
      pins: shownPins,
      paths: shownPaths,
      connectPins: shownPins.length > 1,
    };
  }, [segment, sorted, legsWithCoords, visibleLegs, legPaths]);

  // 드래그 정렬 (같은 day_index 내만 이동) — early return 이전에 선언 필수.
  // 훅은 조건부 return 뒤에 호출하면 "Rules of Hooks" 위반.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">계획을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const handleAddNewDay = (): number => {
    const max = Math.max(-1, ...days);
    return max + 1;
  };

  const openNewSheet = (dayIndex: number) => {
    setSheetTask(null);
    setSheetDayIndex(dayIndex);
    setSheetOpen(true);
  };

  const openEditSheet = (task: TravelPlanTask) => {
    setSheetTask(task);
    setSheetDayIndex(task.day_index);
    setSheetOpen(true);
  };

  const handleTitleCommit = async () => {
    if (titleDraft == null) return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== plan.title) {
      await updatePlan(plan.id, { title: trimmed });
    }
    setTitleDraft(null);
  };

  // 전체 sorted 에 대한 단일 drag-end 핸들러.
  // active → over 의 day_index 가 다르면 day 이동 + manual_order 삽입.
  // 같은 day 내면 순서만 재정렬.
  const handleDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const activeTask = sorted.find((t) => t.id === e.active.id);
    const overTask = sorted.find((t) => t.id === e.over!.id);
    if (!activeTask || !overTask) return;

    if (activeTask.day_index !== overTask.day_index) {
      // 다른 일자로 이동 — overTask 앞에 끼워넣음
      const targetDayTasks = sorted.filter(
        (t) => t.day_index === overTask.day_index && t.id !== activeTask.id
      );
      const overIdx = targetDayTasks.findIndex((t) => t.id === overTask.id);
      targetDayTasks.splice(overIdx, 0, activeTask);
      await updateTask(activeTask.id, { day_index: overTask.day_index });
      for (let i = 0; i < targetDayTasks.length; i++) {
        const t = targetDayTasks[i];
        if (t.id === activeTask.id || t.manual_order !== i) {
          await updateTask(t.id, { manual_order: i });
        }
      }
    } else {
      const dayTasks = sorted.filter((t) => t.day_index === activeTask.day_index);
      const oldIdx = dayTasks.findIndex((t) => t.id === activeTask.id);
      const newIdx = dayTasks.findIndex((t) => t.id === overTask.id);
      if (oldIdx < 0 || newIdx < 0) return;
      const reordered = arrayMove(dayTasks, oldIdx, newIdx);
      for (let i = 0; i < reordered.length; i++) {
        if (reordered[i].manual_order !== i) {
          await updateTask(reordered[i].id, { manual_order: i });
        }
      }
    }
  };

  // 일자별로 task 그룹핑
  const tasksByDay: Record<number, TravelPlanTask[]> = {};
  for (const d of days) tasksByDay[d] = [];
  for (const t of sorted) {
    if (!tasksByDay[t.day_index]) tasksByDay[t.day_index] = [];
    tasksByDay[t.day_index].push(t);
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 — ← 뒤로 + 제목 */}
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
        <div className="mx-auto w-full max-w-3xl">
        {/* 기간 */}
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
            onChange={setSegment}
            days={days}
            legs={legsWithCoords}
          />
          <PlanRouteMap pins={pins} paths={paths} connectPins={connectPins} height={240} />
        </div>

        {/* 일자별 섹션 — 전체를 하나의 DndContext 로 감싸서 날짜 간 이동도 지원 */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sorted.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
        <div className="flex flex-col gap-3 p-3">
          {days.map((day) => {
            const dayTasks = tasksByDay[day] ?? [];
            return (
              <section key={day} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{formatDayLabel(day)}</h3>
                  <span className="text-[10px] text-muted-foreground">
                    {dayTasks.length}개
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {dayTasks.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {dayTasks.map((t, i) => {
                          const next = dayTasks[i + 1];
                          const leg = next
                            ? legsWithCoords.find(
                                (l) => l.fromTaskId === t.id && l.toTaskId === next.id
                              )
                            : undefined;
                          return (
                            <div key={t.id} className="flex flex-col gap-1.5">
                              <SortableTaskRow
                                task={t}
                                onClick={() => openEditSheet(t)}
                                onDelete={() => deleteTask(t.id)}
                                expectedTime={expectedTimes[t.id]?.predicted ? expectedTimes[t.id]?.time : null}
                              />
                              {leg && (
                                <PlanLegCard
                                  leg={leg}
                                  onUpdateTask={updateTask}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openNewSheet(day)}
                  className="self-start h-8 text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> 일정 추가
                </Button>
              </section>
            );
          })}
        </div>
          </SortableContext>
        </DndContext>
        </div>
      </div>

      <PlanTaskSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        task={sheetTask}
        planId={planId}
        defaultDayIndex={sheetDayIndex}
        availableDays={days}
        formatDayLabel={formatDayLabel}
        onAddNewDay={handleAddNewDay}
        onSave={async (updates) => {
          if (sheetTask) {
            await updateTask(sheetTask.id, updates);
          } else {
            await addTask({
              plan_id: planId,
              day_index: updates.day_index ?? sheetDayIndex,
              start_time: updates.start_time ?? null,
              place_name: updates.place_name ?? "",
              place_address: updates.place_address ?? null,
              place_lat: updates.place_lat ?? null,
              place_lng: updates.place_lng ?? null,
              tag: updates.tag ?? null,
              content: updates.content ?? null,
              stay_minutes: updates.stay_minutes ?? 0,
              manual_order: (tasksByDay[updates.day_index ?? sheetDayIndex]?.length) ?? 0,
              transport_mode: null,
              transport_duration_sec: null,
              transport_manual: false,
            });
          }
        }}
        onDelete={
          sheetTask
            ? async () => {
                await deleteTask(sheetTask.id);
              }
            : undefined
        }
      />
    </div>
  );
}

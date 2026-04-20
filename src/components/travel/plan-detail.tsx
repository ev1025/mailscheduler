"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { getRouteData, invalidateRouteData } from "@/hooks/use-route-data";
import { computeExpectedTimes } from "@/lib/travel/expected-time";
import type { TravelPlanTask, TransportMode } from "@/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useDroppable,
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

// 빈 일자에도 드롭 가능하도록 일자 섹션 전체를 droppable zone 으로 감쌈.
// 드롭 시 id "day-{n}" 로 식별 → handleDragEnd 에서 day_index 이동 처리.
function DayDropZone({ day, children }: { day: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 rounded-md transition-colors ${
        isOver ? "bg-primary/5 ring-2 ring-primary/30" : ""
      }`}
    >
      {children}
    </div>
  );
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
  // legPaths: "{fromId}-{toId}-{mode}" 를 key 로 사용 — mode 가 바뀌면 자동으로
  // 새 key 가 되어 이전 path 재사용 금지. 이전엔 (fromId-toId) 만 써서 수단을
  // 바꿔도 예전 경로가 그대로 남았음.
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

  // 날짜는 start_date 가 있든 없든 항상 "M/D(요일)" 로 표시.
  // start_date 미설정 시 오늘을 기준으로 dayIndex 만큼 더해 반환.
  const formatDayLabel = (dayIndex: number): string => {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const baseIso = plan?.start_date ?? todayIso;
    const iso = addDaysISO(baseIso, dayIndex);
    const d = new Date(iso + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
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

  // 보이는 leg 자동 path fetch — 선택된 수단 기준으로 실제 경로 폴리라인.
  // 자가용(NCP)·대중교통·도보(Google) 모두 path 를 주므로 전체 수단 지원.
  // 기차는 Google rail 폴백의 polyline (레일 노선 근사) 표시.
  // 진행 중인 요청 추적 — legPaths 를 deps 에 넣으면 매 setLegPaths 마다
  // 이펙트가 재실행되어 race condition · 중복 호출 발생. useRef 로 분리.
  const pendingPathRequests = useRef<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const leg of visibleLegs) {
        if (cancelled) return;
        const mode: TransportMode | null = leg.toTask.transport_mode ?? null;
        if (!mode) continue;
        const key = `${leg.fromTaskId}-${leg.toTaskId}-${mode}`;
        if (legPaths[key] || pendingPathRequests.current.has(key)) continue;
        pendingPathRequests.current.add(key);
        try {
          const result = await getRouteData(
            { lat: leg.fromTask.place_lat!, lng: leg.fromTask.place_lng! },
            { lat: leg.toTask.place_lat!, lng: leg.toTask.place_lng! },
            mode
          );
          if (cancelled) return;
          if (result?.path && result.path.length > 1) {
            setLegPaths((p) => ({ ...p, [key]: result.path! }));
          }
        } finally {
          pendingPathRequests.current.delete(key);
        }
      }
    })();
    return () => { cancelled = true; };
    // legPaths 는 일부러 deps 에서 제외 — pendingPathRequests.current 로 중복 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLegs]);

  const { pins, legs: mapLegs } = useMemo(() => {
    const taskToPin = (t: TravelPlanTask) =>
      t.place_lat != null && t.place_lng != null
        ? { lat: t.place_lat, lng: t.place_lng, label: t.place_name, taskId: t.id }
        : null;

    let shownTasks: TravelPlanTask[];
    if (segment.mode === "all") shownTasks = sorted;
    else if (segment.mode === "day")
      shownTasks = sorted.filter((t) => t.day_index === segment.dayIndex);
    else {
      const leg = legsWithCoords[segment.legIndex];
      shownTasks = leg ? [leg.fromTask, leg.toTask] : [];
    }
    const shownPinsAll = shownTasks.map(taskToPin).filter(Boolean) as {
      lat: number; lng: number; label: string; taskId: string;
    }[];

    // 보이는 leg 에 대해 path 있으면 실선, 없으면 점선. pins 인덱스 매핑 필요.
    const taskIdToIdx = new Map(shownPinsAll.map((p, i) => [p.taskId, i]));
    type MapLegSpec = { fromIdx: number; toIdx: number; path?: [number, number][] };
    const legsForMap: MapLegSpec[] = [];
    for (const l of visibleLegs) {
      const fromIdx = taskIdToIdx.get(l.fromTaskId);
      const toIdx = taskIdToIdx.get(l.toTaskId);
      if (fromIdx === undefined || toIdx === undefined) continue;
      legsForMap.push({
        fromIdx,
        toIdx,
        // 선택된 수단에 따른 path 조회 — mode 포함 key
        path: l.toTask.transport_mode
          ? legPaths[`${l.fromTaskId}-${l.toTaskId}-${l.toTask.transport_mode}`]
          : undefined,
      });
    }

    // label·lat·lng 만 plan-route-map 에 넘김 (taskId 는 매핑용이라 불필요)
    const shownPins = shownPinsAll.map(({ lat, lng, label }) => ({ lat, lng, label }));

    return { pins: shownPins, legs: legsForMap };
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

  // 순서 변경 시 인접 leg 들 무효화 — transport 필드 리셋 대상 task id 세트.
  //  - moved task 본인 (arriving leg 변경)
  //  - moved task 의 새 next (this → newNext leg 변경)
  //  - moved task 의 기존 next (원래 위치에서의 다음 task — 그 departing leg 변경)
  const resetTransport = async (taskIds: string[]) => {
    for (const id of taskIds) {
      await updateTask(id, {
        transport_mode: null,
        transport_duration_sec: null,
        transport_manual: false,
        transport_durations: null,
      });
    }
  };

  // Drag end:
  //  - task → task (다른 일자): 해당 위치에 끼워넣음 + day_index 변경
  //  - task → task (같은 일자): 순서 재정렬
  //  - task → day zone (빈 일자 등): 해당 일자 맨 뒤로 이동
  const handleDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const activeTask = sorted.find((t) => t.id === e.active.id);
    if (!activeTask) return;
    const overId = String(e.over.id);

    // 원래 위치에서의 기존 next (옛 departing leg 무효)
    const oldDayTasks = sorted.filter((t) => t.day_index === activeTask.day_index);
    const oldIdx = oldDayTasks.findIndex((t) => t.id === activeTask.id);
    const oldNext = oldIdx >= 0 ? oldDayTasks[oldIdx + 1] : undefined;

    // 리셋 대상: 옮겨진 task 본인 + 기존 next (원래 그 사이의 leg 옮겨짐)
    const affected = new Set<string>([activeTask.id]);
    if (oldNext) affected.add(oldNext.id);

    // 빈 일자 droppable 로 드롭한 경우
    if (overId.startsWith("day-")) {
      const targetDay = parseInt(overId.slice(4), 10);
      if (!Number.isFinite(targetDay) || targetDay === activeTask.day_index) return;
      const targetDayTasks = sorted.filter(
        (t) => t.day_index === targetDay && t.id !== activeTask.id
      );
      targetDayTasks.push(activeTask); // 맨 뒤 — 따라서 새 next 없음 (end 에 위치)
      await updateTask(activeTask.id, { day_index: targetDay });
      for (let i = 0; i < targetDayTasks.length; i++) {
        const t = targetDayTasks[i];
        if (t.id === activeTask.id || t.manual_order !== i) {
          await updateTask(t.id, { manual_order: i });
        }
      }
      await resetTransport([...affected]);
      return;
    }

    const overTask = sorted.find((t) => t.id === overId);
    if (!overTask) return;

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
      // 새 next (overTask 가 active 뒤로 밀려난 경우 overTask 가 새 next)
      affected.add(overTask.id);
      await resetTransport([...affected]);
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
      // 재정렬된 배열에서 activeTask 의 새 next
      const newActiveIdx = reordered.findIndex((t) => t.id === activeTask.id);
      const newNext = newActiveIdx >= 0 ? reordered[newActiveIdx + 1] : undefined;
      if (newNext) affected.add(newNext.id);
      await resetTransport([...affected]);
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
    // 자체 스크롤 컨테이너 제거 — 부모 main 의 overflow-y-auto 에 위임.
    // 이중 스크롤 컨테이너 충돌 방지. 헤더는 sticky top-0 으로 상단 고정.
    <div className="flex flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b px-3 h-12 bg-background/95 backdrop-blur">
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

      <div>
        <div className="mx-auto w-full max-w-3xl">
        {/* 기간 — 데스크탑은 DatePicker 폭 제한 (w-40), 모바일은 flex-1 로 가득 */}
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <span className="text-xs text-muted-foreground shrink-0">기간</span>
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <DatePicker
              value={plan.start_date ?? ""}
              onChange={(v) => updatePlan(plan.id, { start_date: v || null })}
              className="h-8 min-w-0 text-xs flex-1 md:flex-none md:w-36"
            />
            <span className="text-xs text-muted-foreground shrink-0">~</span>
            <DatePicker
              value={plan.end_date ?? ""}
              onChange={(v) => updatePlan(plan.id, { end_date: v || null })}
              min={plan.start_date ?? undefined}
              className="h-8 min-w-0 text-xs flex-1 md:flex-none md:w-36"
            />
            {plan.end_date && (
              <button
                type="button"
                onClick={() => updatePlan(plan.id, { end_date: null })}
                className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
                aria-label="종료일 제거"
              >
                <X className="h-3.5 w-3.5" />
              </button>
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
          <PlanRouteMap pins={pins} legs={mapLegs} height={240} />
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
                  <div className="flex-1 h-px bg-border" />
                </div>
                <DayDropZone day={day}>

                {dayTasks.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {dayTasks.map((t, i) => {
                          const next = dayTasks[i + 1];
                          const leg = next
                            ? legsWithCoords.find(
                                (l) => l.fromTaskId === t.id && l.toTaskId === next.id
                              )
                            : undefined;
                          // 이 구간의 출발 시각 = 현재 task 의 [도착시간 + 체류분]
                          let legDeparture: string | null = null;
                          if (leg) {
                            const arr = expectedTimes[t.id]?.time ?? null;
                            if (arr) {
                              const [hh, mm] = arr.split(":").map((s) => parseInt(s, 10));
                              const stay = t.stay_minutes ?? 0;
                              const total = hh * 60 + mm + stay;
                              const w = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
                              legDeparture = `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(w % 60).padStart(2, "0")}`;
                            }
                          }
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
                                  legDeparture={legDeparture}
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
                </DayDropZone>
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
            // 위치가 변경됐으면 이동수단 정보 전부 무효 — 두 leg 영향.
            // (1) 이 task 의 arriving leg (prev→this) → this.transport_* 리셋
            // (2) 이 task 의 departing leg (this→next) → next.transport_* 리셋
            const placeChanged =
              updates.place_lat !== sheetTask.place_lat ||
              updates.place_lng !== sheetTask.place_lng;

            let finalUpdates = updates;
            if (placeChanged) {
              finalUpdates = {
                ...updates,
                transport_mode: null,
                transport_duration_sec: null,
                transport_manual: false,
                transport_durations: null,
              };
              // 관련 leg 의 route 캐시도 무효화 (메모리 cache 엔트리 제거)
              const targetDay = updates.day_index ?? sheetTask.day_index;
              const dayTasks = sorted.filter((t) => t.day_index === targetDay);
              const myIdx = dayTasks.findIndex((t) => t.id === sheetTask.id);
              const prev = myIdx > 0 ? dayTasks[myIdx - 1] : undefined;
              const next = myIdx >= 0 ? dayTasks[myIdx + 1] : undefined;
              // 이전 이동수단 path 캐시 무효화 (from/to 중 하나가 바뀌었으므로)
              if (prev?.place_lat != null && prev?.place_lng != null &&
                  sheetTask.place_lat != null && sheetTask.place_lng != null) {
                invalidateRouteData(
                  { lat: prev.place_lat, lng: prev.place_lng },
                  { lat: sheetTask.place_lat, lng: sheetTask.place_lng }
                );
              }
              if (next?.place_lat != null && next?.place_lng != null &&
                  sheetTask.place_lat != null && sheetTask.place_lng != null) {
                invalidateRouteData(
                  { lat: sheetTask.place_lat, lng: sheetTask.place_lng },
                  { lat: next.place_lat, lng: next.place_lng }
                );
              }
              if (next) {
                await updateTask(next.id, {
                  transport_mode: null,
                  transport_duration_sec: null,
                  transport_manual: false,
                  transport_durations: null,
                });
              }
            }
            await updateTask(sheetTask.id, finalUpdates);
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
              category: updates.category ?? null,
              content: updates.content ?? null,
              stay_minutes: updates.stay_minutes ?? 0,
              manual_order: (tasksByDay[updates.day_index ?? sheetDayIndex]?.length) ?? 0,
              transport_mode: null,
              transport_duration_sec: null,
              transport_manual: false,
              // transport_durations 는 SQL 마이그레이션 후 자동 채워지므로 insert 에서 제외
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

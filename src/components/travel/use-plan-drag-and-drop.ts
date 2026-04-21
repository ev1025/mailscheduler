"use client";

import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";
import type { TravelPlanTask } from "@/types";

// 여행 계획 task DnD 핸들러. plan-detail 에서 재사용 가능하게 분리.
//
// 시나리오:
//  1. task → task (같은 일자): 순서 재정렬
//  2. task → task (다른 일자): 해당 task 앞에 끼워넣음 + day_index 변경
//  3. task → "day-N" droppable: 해당 일자 맨 뒤로 이동
//
// 순서·일자 변경 시 인접 leg 의 transport_* 필드 자동 리셋 (경로 재산정 유도).

interface Args {
  sorted: TravelPlanTask[];
  updateTask: (id: string, updates: Partial<TravelPlanTask>) => Promise<unknown>;
}

const TRANSPORT_RESET = {
  transport_mode: null,
  transport_duration_sec: null,
  transport_manual: false,
  transport_durations: null,
} as const;

export function createPlanDragEndHandler({ sorted, updateTask }: Args) {
  const resetTransport = async (taskIds: Iterable<string>) => {
    for (const id of taskIds) {
      await updateTask(id, TRANSPORT_RESET);
    }
  };

  return async (e: DragEndEvent): Promise<void> => {
    if (!e.over || e.active.id === e.over.id) return;
    const activeTask = sorted.find((t) => t.id === e.active.id);
    if (!activeTask) return;
    const overId = String(e.over.id);

    // 원래 위치에서의 기존 next — 옛 departing leg 가 무효됨
    const oldDayTasks = sorted.filter((t) => t.day_index === activeTask.day_index);
    const oldIdx = oldDayTasks.findIndex((t) => t.id === activeTask.id);
    const oldNext = oldIdx >= 0 ? oldDayTasks[oldIdx + 1] : undefined;

    const affected = new Set<string>([activeTask.id]);
    if (oldNext) affected.add(oldNext.id);

    // 1) 빈 일자 droppable ("day-N") 로 드롭
    if (overId.startsWith("day-")) {
      const targetDay = parseInt(overId.slice(4), 10);
      if (!Number.isFinite(targetDay) || targetDay === activeTask.day_index) return;
      const targetDayTasks = sorted.filter(
        (t) => t.day_index === targetDay && t.id !== activeTask.id
      );
      targetDayTasks.push(activeTask);
      await updateTask(activeTask.id, { day_index: targetDay });
      for (let i = 0; i < targetDayTasks.length; i++) {
        const t = targetDayTasks[i];
        if (t.id === activeTask.id || t.manual_order !== i) {
          await updateTask(t.id, { manual_order: i });
        }
      }
      await resetTransport(affected);
      return;
    }

    const overTask = sorted.find((t) => t.id === overId);
    if (!overTask) return;

    // 2) 다른 일자 task 로 드롭 — 앞에 끼워넣음
    if (activeTask.day_index !== overTask.day_index) {
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
      affected.add(overTask.id);
      await resetTransport(affected);
      return;
    }

    // 3) 같은 일자 내 순서 변경
    const dayTasks = sorted.filter((t) => t.day_index === activeTask.day_index);
    const fromIdx = dayTasks.findIndex((t) => t.id === activeTask.id);
    const toIdx = dayTasks.findIndex((t) => t.id === overTask.id);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = arrayMove(dayTasks, fromIdx, toIdx);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].manual_order !== i) {
        await updateTask(reordered[i].id, { manual_order: i });
      }
    }
    const newActiveIdx = reordered.findIndex((t) => t.id === activeTask.id);
    const newNext = newActiveIdx >= 0 ? reordered[newActiveIdx + 1] : undefined;
    if (newNext) affected.add(newNext.id);
    await resetTransport(affected);
  };
}

import type { TravelPlanTask } from "@/types";

// 정렬된 tasks 를 인접한 두 task 쌍으로 묶은 "leg(구간)" 배열로 변환.
// 같은 day_index 안에서만 leg 생성(일자가 바뀌면 이동 leg 아님).
// 양쪽 모두 좌표가 있어야 자동 경로 계산 가능 → 조건부 필터링은 소비자에서.

export interface TaskLeg {
  fromTaskId: string;
  toTaskId: string;
  fromTask: TravelPlanTask;
  toTask: TravelPlanTask;
  dayIndex: number;
}

export function tasksToLegs(sorted: TravelPlanTask[]): TaskLeg[] {
  const legs: TaskLeg[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.day_index !== cur.day_index) continue;
    legs.push({
      fromTaskId: prev.id,
      toTaskId: cur.id,
      fromTask: prev,
      toTask: cur,
      dayIndex: cur.day_index,
    });
  }
  return legs;
}

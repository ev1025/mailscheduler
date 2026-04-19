import type { TravelPlanTask } from "@/types";

// 정렬 규칙:
// 1) day_index 오름차순
// 2) 같은 day_index 내 → start_time 있는 것 먼저(시각 오름차순), 없는 것은 뒤로
// 3) 동률은 manual_order 오름차순

export function sortTasks(tasks: TravelPlanTask[]): TravelPlanTask[] {
  return [...tasks].sort((a, b) => {
    if (a.day_index !== b.day_index) return a.day_index - b.day_index;
    const aHas = !!a.start_time;
    const bHas = !!b.start_time;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas) {
      if (a.start_time! < b.start_time!) return -1;
      if (a.start_time! > b.start_time!) return 1;
    }
    return a.manual_order - b.manual_order;
  });
}

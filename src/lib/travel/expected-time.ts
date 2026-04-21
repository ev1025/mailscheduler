import type { TravelPlanTask } from "@/types";
import { fromMinutes, toMinutes } from "@/lib/travel/time";

// 정렬된 task 들에 대해 각 task 의 "예상 도착 시각"을 계산.
// 규칙 (변경됨 — 자동 조절 강화):
//  - 각 일자의 **첫 task** 만 start_time 을 anchor 로 사용 (있으면 고정 시간)
//  - 이후 task 들은 start_time 이 설정돼 있어도 무시하고 체인 계산값 사용
//    → 이전 arrival + 이전 stay + 현재 구간 이동시간
//  - anchor 가 없거나 체인이 끊기면 null
//  - 일자 바뀌면 누적 초기화
//
// 기존엔 중간 task 의 start_time 이 anchor 가 되어 교통수단·체류 변경해도
// 반영되지 않는 문제 발생. 이제 중간 task 에 "잔류 start_time" 이 있어도
// 체인 계산이 항상 우선.
//
// 반환: { taskId → { time: "HH:MM" | null, predicted: boolean } }

export interface ExpectedTimeInfo {
  time: string | null;   // HH:MM
  predicted: boolean;    // 첫 task 는 false, 체인 계산된 건 true
}

export function computeExpectedTimes(
  sorted: TravelPlanTask[]
): Record<string, ExpectedTimeInfo> {
  const result: Record<string, ExpectedTimeInfo> = {};
  let prevTask: TravelPlanTask | null = null;
  let prevTime: string | null = null;

  for (const t of sorted) {
    // 일자가 바뀌면 누적 초기화 — 이 task 가 해당 일자 첫 task
    if (!prevTask || prevTask.day_index !== t.day_index) {
      prevTask = t;
      const actual = t.start_time ? t.start_time.slice(0, 5) : null;
      // 첫 task: predicted=false (사용자 anchor 또는 미설정)
      result[t.id] = { time: actual, predicted: false };
      prevTime = actual;
      continue;
    }

    // 중간 task: 체인 계산이 가능하면 항상 계산값 사용 (start_time 있어도 무시)
    if (prevTime != null) {
      const stay = prevTask.stay_minutes ?? 0;
      const moveSec = t.transport_duration_sec ?? 0;
      const moveMin = Math.round(moveSec / 60);
      const next = fromMinutes(toMinutes(prevTime) + stay + moveMin);
      result[t.id] = { time: next, predicted: true };
      prevTime = next;
      prevTask = t;
      continue;
    }

    // 체인 끊김 (첫 task 에 anchor 없었음) — stored start_time 이라도 표시
    const fallback = t.start_time ? t.start_time.slice(0, 5) : null;
    result[t.id] = { time: fallback, predicted: false };
    prevTime = fallback;
    prevTask = t;
  }
  return result;
}

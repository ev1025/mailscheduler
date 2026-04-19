import type { TravelPlanTask } from "@/types";

// 정렬된 task 들에 대해 각 task 의 "예상 도착 시각"을 계산.
// 규칙:
//  - 직접 입력된 start_time 이 있으면 그 값이 최우선(실제 시간)
//  - 없으면 이전 task 의 [실제 or 예상 시간] + 이전 task 의 체류(분) + 이 구간 이동(초)
//  - 이전 task 의 시간을 전혀 알 수 없으면(null) 이 task 도 null
// 일자가 바뀌면 누적이 끊기므로 day_index 별로 독립 계산.
//
// 반환: { taskId → { time: "HH:MM" | null, predicted: boolean } }

export interface ExpectedTimeInfo {
  time: string | null;   // HH:MM
  predicted: boolean;    // 사용자가 직접 입력한 값이 아니라 계산된 값인지
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function fromMinutes(min: number): string {
  const total = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function computeExpectedTimes(
  sorted: TravelPlanTask[]
): Record<string, ExpectedTimeInfo> {
  const result: Record<string, ExpectedTimeInfo> = {};
  let prevTask: TravelPlanTask | null = null;
  let prevTime: string | null = null;

  for (const t of sorted) {
    // 일자가 바뀌면 누적 초기화
    if (!prevTask || prevTask.day_index !== t.day_index) {
      prevTask = t;
      const actual = t.start_time ? t.start_time.slice(0, 5) : null;
      result[t.id] = { time: actual, predicted: false };
      prevTime = actual;
      continue;
    }

    // 사용자가 직접 입력한 시간이 있으면 그 값 사용
    if (t.start_time) {
      const actual = t.start_time.slice(0, 5);
      result[t.id] = { time: actual, predicted: false };
      prevTime = actual;
      prevTask = t;
      continue;
    }

    // 예상 계산: prevTime + prevTask.stay_minutes + leg.transport_duration_sec/60
    if (prevTime) {
      const stay = prevTask.stay_minutes ?? 0;
      const moveSec = t.transport_duration_sec ?? 0;
      const moveMin = Math.round(moveSec / 60);
      if (moveSec > 0 || stay > 0) {
        const next = fromMinutes(toMinutes(prevTime) + stay + moveMin);
        result[t.id] = { time: next, predicted: true };
        prevTime = next;
        prevTask = t;
        continue;
      }
    }

    // 계산할 근거가 없음
    result[t.id] = { time: null, predicted: false };
    prevTime = null;
    prevTask = t;
  }
  return result;
}

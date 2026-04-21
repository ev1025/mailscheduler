// 여행 계획 전역 시간 유틸 — HH:MM 문자열 ↔ 분 단위 변환.
// plan-task-row / plan-transport-picker / expected-time 에 중복 정의되던 것 통합.

/** "HH:MM:SS" 또는 "HH:MM" → "HH:MM". null 입력이면 "". */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

/** "HH:MM" → 분. 유효하지 않으면 0. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/** 분(정수) → "HH:MM". 24시간 순환(음수·24 이상은 mod 24). */
export function fromMinutes(min: number): string {
  const total = ((Math.round(min) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" + N분 → "HH:MM" (24h 순환). */
export function addMinutes(hhmm: string, addMin: number): string {
  return fromMinutes(toMinutes(hhmm) + addMin);
}

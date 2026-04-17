// 공휴일 데이터 — Nager.Date API + 수동 임시공휴일

import { useState, useEffect } from "react";

interface Holiday {
  date: string;
  name: string;
}

// API에 없는 임시·추가 공휴일 (선거일, 근로자의날 등)
const MANUAL_HOLIDAYS: Record<number, Holiday[]> = {
  2025: [
    { date: "2025-05-01", name: "근로자의날" },
  ],
  2026: [
    { date: "2026-05-01", name: "근로자의날" },
    { date: "2026-06-03", name: "제9회 지방선거" },
  ],
  2027: [
    { date: "2027-05-01", name: "근로자의날" },
  ],
  2028: [
    { date: "2028-05-01", name: "근로자의날" },
  ],
};

const CACHE_KEY = "holidays_cache_v3";
const NAME_MAP: Record<string, string> = {
  "New Year's Day": "새해",
  "Independence Movement Day": "삼일절",
  "Children's Day": "어린이날",
  "Memorial Day": "현충일",
  "Liberation Day": "광복절",
  "National Foundation Day": "개천절",
  "Hangul Day": "한글날",
  "Christmas Day": "크리스마스",
  "Lunar New Year": "설날",
  "Lunar New Year's Eve": "설날 연휴",
  "Second day of Lunar New Year": "설날 연휴",
  "Buddha's Birthday": "부처님오신날",
  "Chuseok": "추석",
  "The day before Chuseok": "추석 연휴",
  "Second day of Chuseok": "추석 연휴",
};

function loadCache(year: number): Holiday[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}:${year}`);
    if (!raw) return null;
    const { holidays, fetchedAt } = JSON.parse(raw);
    if (Date.now() - new Date(fetchedAt).getTime() > 30 * 86400000) return null;
    return holidays;
  } catch { return null; }
}

function saveCache(year: number, holidays: Holiday[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(`${CACHE_KEY}:${year}`, JSON.stringify({ holidays, fetchedAt: new Date().toISOString() })); } catch {}
}

async function fetchFromAPI(year: number): Promise<Holiday[] | null> {
  try {
    // 1차: 자체 API 라우트 (한국천문연구원 특일정보)
    const res = await fetch(`/api/holidays?year=${year}`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data: Holiday[] = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
    // 2차 폴백: Nager.Date
    const res2 = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`, { signal: AbortSignal.timeout(5000) });
    if (!res2.ok) return null;
    const data2: Array<{ date: string; name: string; localName: string }> = await res2.json();
    return data2.map((d) => ({ date: d.date, name: NAME_MAP[d.name] || d.localName || d.name }));
  } catch { return null; }
}

function merge(holidays: Holiday[], year: number): Holiday[] {
  const manual = MANUAL_HOLIDAYS[year] || [];
  const dateSet = new Set(holidays.map((h) => h.date));
  const merged = [...holidays];
  for (const m of manual) { if (!dateSet.has(m.date)) merged.push(m); }
  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

// 양력 고정 폴백 (API 실패 시)
const FALLBACK = [
  { month: 1, day: 1, name: "새해" }, { month: 3, day: 1, name: "삼일절" },
  { month: 5, day: 5, name: "어린이날" }, { month: 6, day: 6, name: "현충일" },
  { month: 8, day: 15, name: "광복절" }, { month: 10, day: 3, name: "개천절" },
  { month: 10, day: 9, name: "한글날" }, { month: 12, day: 25, name: "크리스마스" },
];

function getFallback(year: number): Holiday[] {
  return FALLBACK.map((h) => ({
    date: `${year}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`,
    name: h.name,
  }));
}

// 구독자 패턴 — API 로딩 완료 시 모든 사용처에 알림
const listeners = new Set<() => void>();
const memCache: Record<number, Holiday[]> = {};
const fetching = new Set<number>();

function notifyAll() { listeners.forEach((fn) => fn()); }

function ensureData(year: number) {
  if (memCache[year]) return;
  const cached = loadCache(year);
  if (cached) { memCache[year] = merge(cached, year); return; }
  memCache[year] = merge(getFallback(year), year);
  if (!fetching.has(year)) {
    fetching.add(year);
    fetchFromAPI(year).then((apiData) => {
      if (apiData) {
        saveCache(year, apiData);
        memCache[year] = merge(apiData, year);
        notifyAll();
      }
      fetching.delete(year);
    });
  }
}

/** 동기 — 캐시 우선, API 백그라운드 갱신 */
export function getHolidays(year: number): Holiday[] {
  ensureData(year);
  return memCache[year] || [];
}

export function getHolidayMap(year: number): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of getHolidays(year)) map[h.date] = h.name;
  return map;
}

/** 리액티브 훅 — API 로딩 후 자동 재렌더 */
export function useHolidayMap(year: number): Record<string, string> {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    ensureData(year);
    return () => { listeners.delete(fn); };
  }, [year]);
  return getHolidayMap(year);
}

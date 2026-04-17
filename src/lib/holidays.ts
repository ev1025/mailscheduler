// 공휴일 데이터 — Nager.Date API(무료) + 수동 임시공휴일 + 캐시

interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

// 임시공휴일 (선거일 등 — API에 없을 수 있는 일회성 공휴일)
const MANUAL_HOLIDAYS: Record<number, Holiday[]> = {
  2026: [
    { date: "2026-06-03", name: "제9회 지방선거" },
  ],
};

const CACHE_KEY = "holidays_cache_v2";

interface CacheEntry {
  holidays: Holiday[];
  fetchedAt: string;
}

function loadCache(year: number): Holiday[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}:${year}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    // 30일 이내 캐시만 사용
    const age = Date.now() - new Date(entry.fetchedAt).getTime();
    if (age > 30 * 86400000) return null;
    return entry.holidays;
  } catch {
    return null;
  }
}

function saveCache(year: number, holidays: Holiday[]) {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry = { holidays, fetchedAt: new Date().toISOString() };
    localStorage.setItem(`${CACHE_KEY}:${year}`, JSON.stringify(entry));
  } catch { /* ignore */ }
}

// 한국어 공휴일 이름 매핑
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

function translateName(name: string, localName: string): string {
  return NAME_MAP[name] || localName || name;
}

// 양력 고정 공휴일 (API 실패 시 폴백)
const FALLBACK_FIXED = [
  { month: 1, day: 1, name: "새해" },
  { month: 3, day: 1, name: "삼일절" },
  { month: 5, day: 5, name: "어린이날" },
  { month: 6, day: 6, name: "현충일" },
  { month: 8, day: 15, name: "광복절" },
  { month: 10, day: 3, name: "개천절" },
  { month: 10, day: 9, name: "한글날" },
  { month: 12, day: 25, name: "크리스마스" },
];

function getFallbackHolidays(year: number): Holiday[] {
  return FALLBACK_FIXED.map((h) => ({
    date: `${year}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`,
    name: h.name,
  }));
}

// API 호출 (Nager.Date — 무료, 키 불필요)
async function fetchFromAPI(year: number): Promise<Holiday[] | null> {
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: Array<{ date: string; name: string; localName: string }> = await res.json();
    return data.map((d) => ({
      date: d.date,
      name: translateName(d.name, d.localName),
    }));
  } catch {
    return null;
  }
}

// 인메모리 캐시 (같은 세션 내 반복 호출 방지)
const memCache: Record<number, Holiday[]> = {};
const fetchPromises: Record<number, Promise<void>> = {};

/** 공휴일 목록 가져오기 (동기 — 캐시 우선, 백그라운드 갱신) */
export function getHolidays(year: number): Holiday[] {
  // 1. 메모리 캐시
  if (memCache[year]) return memCache[year];

  // 2. localStorage 캐시
  const cached = loadCache(year);
  if (cached) {
    const merged = mergeManual(cached, year);
    memCache[year] = merged;
    return merged;
  }

  // 3. 폴백 (API 아직 안 온 상태)
  const fallback = mergeManual(getFallbackHolidays(year), year);
  memCache[year] = fallback;

  // 4. 백그라운드 API 호출
  if (!fetchPromises[year]) {
    fetchPromises[year] = fetchFromAPI(year).then((apiData) => {
      if (apiData) {
        saveCache(year, apiData);
        memCache[year] = mergeManual(apiData, year);
      }
    });
  }

  return fallback;
}

function mergeManual(holidays: Holiday[], year: number): Holiday[] {
  const manual = MANUAL_HOLIDAYS[year] || [];
  const dateSet = new Set(holidays.map((h) => h.date));
  const merged = [...holidays];
  for (const m of manual) {
    if (!dateSet.has(m.date)) merged.push(m);
  }
  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

export function getHolidayMap(year: number): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of getHolidays(year)) {
    map[h.date] = h.name;
  }
  return map;
}

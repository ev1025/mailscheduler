// 대한민국 공휴일 (양력 고정 + 음력 변동)
// 음력 공휴일은 연도별로 양력 날짜가 다르므로 연도별 데이터 필요

interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

// 양력 고정 공휴일
const FIXED_HOLIDAYS: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: "새해" },
  { month: 3, day: 1, name: "삼일절" },
  { month: 5, day: 5, name: "어린이날" },
  { month: 6, day: 6, name: "현충일" },
  { month: 8, day: 15, name: "광복절" },
  { month: 10, day: 3, name: "개천절" },
  { month: 10, day: 9, name: "한글날" },
  { month: 12, day: 25, name: "크리스마스" },
];

// 음력 기반 공휴일 (양력 변환 - 주요 연도만)
// 설날(음력1/1), 추석(음력8/15), 부처님오신날(음력4/8)
const LUNAR_HOLIDAYS: Record<number, Holiday[]> = {
  2024: [
    { date: "2024-02-09", name: "설날 연휴" },
    { date: "2024-02-10", name: "설날" },
    { date: "2024-02-11", name: "설날 연휴" },
    { date: "2024-02-12", name: "대체공휴일(설날)" },
    { date: "2024-05-15", name: "부처님오신날" },
    { date: "2024-09-16", name: "추석 연휴" },
    { date: "2024-09-17", name: "추석" },
    { date: "2024-09-18", name: "추석 연휴" },
  ],
  2025: [
    { date: "2025-01-28", name: "설날 연휴" },
    { date: "2025-01-29", name: "설날" },
    { date: "2025-01-30", name: "설날 연휴" },
    { date: "2025-05-05", name: "부처님오신날" },
    { date: "2025-10-05", name: "추석 연휴" },
    { date: "2025-10-06", name: "추석" },
    { date: "2025-10-07", name: "추석 연휴" },
    { date: "2025-10-08", name: "대체공휴일(추석)" },
  ],
  2026: [
    { date: "2026-02-16", name: "설날 연휴" },
    { date: "2026-02-17", name: "설날" },
    { date: "2026-02-18", name: "설날 연휴" },
    { date: "2026-05-24", name: "부처님오신날" },
    { date: "2026-09-24", name: "추석 연휴" },
    { date: "2026-09-25", name: "추석" },
    { date: "2026-09-26", name: "추석 연휴" },
  ],
  2027: [
    { date: "2027-02-06", name: "설날 연휴" },
    { date: "2027-02-07", name: "설날" },
    { date: "2027-02-08", name: "설날 연휴" },
    { date: "2027-02-09", name: "대체공휴일(설날)" },
    { date: "2027-05-13", name: "부처님오신날" },
    { date: "2027-09-14", name: "추석 연휴" },
    { date: "2027-09-15", name: "추석" },
    { date: "2027-09-16", name: "추석 연휴" },
  ],
  2028: [
    { date: "2028-01-26", name: "설날 연휴" },
    { date: "2028-01-27", name: "설날" },
    { date: "2028-01-28", name: "설날 연휴" },
    { date: "2028-05-02", name: "부처님오신날" },
    { date: "2028-10-02", name: "추석 연휴" },
    { date: "2028-10-03", name: "추석" },
    { date: "2028-10-04", name: "추석 연휴" },
  ],
  2029: [
    { date: "2029-02-12", name: "설날 연휴" },
    { date: "2029-02-13", name: "설날" },
    { date: "2029-02-14", name: "설날 연휴" },
    { date: "2029-05-20", name: "부처님오신날" },
    { date: "2029-09-21", name: "추석 연휴" },
    { date: "2029-09-22", name: "추석" },
    { date: "2029-09-23", name: "추석 연휴" },
  ],
  2030: [
    { date: "2030-02-02", name: "설날 연휴" },
    { date: "2030-02-03", name: "설날" },
    { date: "2030-02-04", name: "설날 연휴" },
    { date: "2030-05-09", name: "부처님오신날" },
    { date: "2030-09-11", name: "추석 연휴" },
    { date: "2030-09-12", name: "추석" },
    { date: "2030-09-13", name: "추석 연휴" },
  ],
};

export function getHolidays(year: number): Holiday[] {
  const holidays: Holiday[] = [];

  // 양력 고정 공휴일
  for (const h of FIXED_HOLIDAYS) {
    holidays.push({
      date: `${year}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`,
      name: h.name,
    });
  }

  // 음력 기반 공휴일
  const lunar = LUNAR_HOLIDAYS[year];
  if (lunar) {
    holidays.push(...lunar);
  }

  return holidays;
}

export function getHolidayMap(year: number): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of getHolidays(year)) {
    map[h.date] = h.name;
  }
  return map;
}

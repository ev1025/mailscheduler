import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.HOLIDAY_API_KEY || "";
const BASE = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

interface HolidayItem {
  dateKind: string;
  dateName: string;
  isHoliday: string;
  locdate: number;
  seq: number;
}

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get("year");
  if (!year) return NextResponse.json({ error: "year required" }, { status: 400 });
  if (!API_KEY) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  try {
    // 전체 연도 조회 (numOfRows=100으로 넉넉히)
    const url = `${BASE}?serviceKey=${API_KEY}&solYear=${year}&numOfRows=100&_type=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } }); // 24시간 캐시
    if (!res.ok) {
      // 폴백: 월별 시도
      return NextResponse.json({ error: "API error", status: res.status }, { status: 502 });
    }

    const json = await res.json();
    const body = json?.response?.body;
    if (!body) return NextResponse.json([]);

    const rawItems = body.items?.item;
    if (!rawItems) return NextResponse.json([]);

    // 단일 결과는 배열이 아닌 객체로 올 수 있음
    const items: HolidayItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];

    const holidays = items
      .filter((item) => item.isHoliday === "Y")
      .map((item) => {
        const d = String(item.locdate);
        return {
          date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
          name: item.dateName,
        };
      });

    return NextResponse.json(holidays);
  } catch (err) {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}

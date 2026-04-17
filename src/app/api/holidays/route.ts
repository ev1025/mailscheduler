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
    // Vercel/로컬에 Decoding(원문) 키를 등록했어도 동작하도록 재인코딩
    // 이미 인코딩된 키(%2B 등 포함)는 원문으로 복원 후 다시 인코딩 → 항상 정확
    const rawKey = API_KEY.includes("%") ? decodeURIComponent(API_KEY) : API_KEY;
    const keyForUrl = encodeURIComponent(rawKey);

    const url = `${BASE}?serviceKey=${keyForUrl}&solYear=${year}&numOfRows=100&_type=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } }); // 24시간 캐시
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[holidays] API error", res.status, text.slice(0, 200));
      return NextResponse.json({ error: "API error", status: res.status }, { status: 502 });
    }

    const text = await res.text();
    // 공공데이터 포털은 에러 시 XML을 반환하기도 함 — 감지해서 로그
    if (text.trim().startsWith("<")) {
      console.error("[holidays] got XML (likely auth error)", text.slice(0, 300));
      return NextResponse.json({ error: "auth or XML error" }, { status: 502 });
    }

    let json: unknown;
    try { json = JSON.parse(text); } catch {
      console.error("[holidays] non-JSON response", text.slice(0, 200));
      return NextResponse.json({ error: "invalid response" }, { status: 502 });
    }
    const body = (json as { response?: { body?: { items?: { item?: HolidayItem | HolidayItem[] } } } })?.response?.body;
    if (!body) return NextResponse.json([]);

    const rawItems = body.items?.item;
    if (!rawItems) return NextResponse.json([]);

    // 단일 결과는 배열이 아닌 객체로 올 수 있음
    const items: HolidayItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];

    const holidays = items
      .filter((item) => item.isHoliday === "Y")
      .map((item) => {
        const d = String(item.locdate);
        // "대체공휴일(부처님오신날)" 같이 괄호 붙은 건 "대체공휴일"만 표시
        const name = item.dateName.startsWith("대체공휴일")
          ? "대체공휴일"
          : item.dateName;
        return {
          date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
          name,
        };
      });

    return NextResponse.json(holidays);
  } catch (err) {
    console.error("[holidays] fetch exception", err);
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}

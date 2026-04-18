import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 네이버 개발자센터 Local Search API 프록시.
// 브라우저에서 CORS 걸리고 Client Secret 도 노출 불가하므로 서버 라우트로 우회.
// 키는 설정 → API 탭에서 사용자가 입력한 값을 app_settings 테이블에서 읽어 사용.

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"
);

async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ? String(data.value) : null;
}

// 네이버 API 응답 title 의 <b>...</b> 하이라이트 태그 제거
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

// 네이버 Local Search 의 mapx/mapy 는 WGS84 좌표 × 10,000,000 의 정수값으로 내려옴.
function scaleCoord(raw: string | number): number {
  const n = typeof raw === "number" ? raw : parseInt(raw, 10);
  return n / 10_000_000;
}

export interface NaverPlace {
  name: string;          // 장소명 (태그 제거됨)
  category: string;      // 예: "카페,디저트>커피전문점"
  address: string;       // 지번 주소
  roadAddress: string;   // 도로명 주소
  telephone: string;
  lat: number;
  lng: number;
  link: string;          // 홈페이지
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const clientId = await getSetting("naver_search_client_id");
  const clientSecret = await getSetting("naver_search_client_secret");
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "네이버 검색 API 키가 설정되지 않았습니다. 설정 → API 탭에서 입력하세요." },
      { status: 503 }
    );
  }

  const url = new URL("https://openapi.naver.com/v1/search/local.json");
  url.searchParams.set("query", q);
  url.searchParams.set("display", "5");
  url.searchParams.set("sort", "random");

  const res = await fetch(url.toString(), {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const msg = await res.text();
    return NextResponse.json({ error: `Naver API ${res.status}: ${msg}` }, { status: res.status });
  }

  const data = (await res.json()) as {
    items?: Array<{
      title: string;
      category: string;
      address: string;
      roadAddress: string;
      telephone: string;
      mapx: string;
      mapy: string;
      link: string;
    }>;
  };

  const items: NaverPlace[] = (data.items ?? []).map((it) => ({
    name: stripTags(it.title),
    category: it.category,
    address: it.address,
    roadAddress: it.roadAddress,
    telephone: it.telephone,
    lat: scaleCoord(it.mapy),
    lng: scaleCoord(it.mapx),
    link: it.link,
  }));

  return NextResponse.json({ items });
}

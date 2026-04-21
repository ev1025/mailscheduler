import { NextResponse } from "next/server";

// Google Directions API 진단 엔드포인트.
// 브라우저에서 https://<도메인>/api/diagnose-google 열면 현재 서버의
// 환경변수·API 키 상태와 실제 테스트 호출 결과를 JSON 으로 반환.
//
// 사용 시나리오: "계산 실패" 가 지속될 때 어느 단계에서 막히는지 1초만에 확인.
//  1) env 누락   → keyPresent=false
//  2) 키 제한    → googleStatus=REQUEST_DENIED
//  3) 빌링 미설정 → googleStatus=REQUEST_DENIED (+error_message 에 billing)
//  4) 쿼터 초과  → googleStatus=OVER_QUERY_LIMIT
//  5) 정상       → ok=true + 서울역→시청역 duration/segments

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const keyPresent = !!apiKey;
  const keyPrefix = apiKey ? apiKey.slice(0, 6) + "…" : null;

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      stage: "env",
      keyPresent: false,
      hint:
        "Vercel Dashboard → Settings → Environment Variables 에 " +
        "GOOGLE_MAPS_API_KEY 를 추가하고 재배포(Deploy) 해야 합니다. " +
        "로컬 .env.local 은 Vercel 에 자동 반영되지 않습니다.",
    });
  }

  // 서울역(37.5547, 126.9707) → 시청역(37.5658, 126.9769) — 지하철·버스 둘 다 잡히는 표본
  const tests = ["transit", "subway", "bus"] as const;
  const results: Record<string, unknown> = {};

  for (const mode of tests) {
    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", "37.5547,126.9707");
    url.searchParams.set("destination", "37.5658,126.9769");
    url.searchParams.set("mode", "transit");
    if (mode !== "transit") url.searchParams.set("transit_mode", mode);
    url.searchParams.set("language", "ko");
    url.searchParams.set("region", "kr");
    url.searchParams.set("key", apiKey);

    try {
      const res = await fetch(url.toString(), { cache: "no-store" });
      const text = await res.text();
      let json: { status?: string; error_message?: string; routes?: unknown[] } = {};
      try {
        json = JSON.parse(text);
      } catch {
        /* non-json */
      }
      results[mode] = {
        httpStatus: res.status,
        googleStatus: json.status,
        googleMessage: json.error_message,
        routesCount: json.routes?.length ?? 0,
      };
    } catch (e) {
      results[mode] = { error: String(e) };
    }
  }

  // 요약 판정
  const firstMode = results.transit as { googleStatus?: string } | undefined;
  const summary = firstMode?.googleStatus ?? "UNKNOWN";
  const ok = summary === "OK";

  return NextResponse.json({
    ok,
    stage: ok ? "ready" : summary,
    keyPresent,
    keyPrefix,
    results,
    hint:
      summary === "REQUEST_DENIED"
        ? "Google Cloud Console → APIs & Services: (1) Directions API 활성화, (2) 빌링 설정, (3) 키의 API Restrictions 에서 Directions API 허용 중 하나가 누락됐습니다."
        : summary === "OVER_QUERY_LIMIT"
          ? "일일/분당 쿼터 초과. Google Cloud Console 에서 Quotas 확인."
          : summary === "ZERO_RESULTS"
            ? "샘플 좌표(서울역→시청역)가 이상하게 해석됐을 수 있음. 환경은 정상."
            : ok
              ? "정상. 실제 앱에서 실패가 지속되면 브라우저 하드 리프레시(Ctrl+Shift+R) 해보세요."
              : undefined,
  });
}

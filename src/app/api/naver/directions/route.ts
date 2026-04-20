import { NextRequest, NextResponse } from "next/server";

// NCP Directions 5 (자가용) 프록시.
// 브라우저 <fetch>에서 Client Secret 노출 금지 → 서버에서 헤더 인증.
// 응답은 duration(초) + path([[lng,lat], ...]) 로 정규화.

export const dynamic = "force-dynamic";

interface DirectionsSummary {
  duration?: number; // ms
}

interface TraOptimalRoute {
  summary?: DirectionsSummary;
  path?: [number, number][]; // [[lng, lat], ...]
}

interface DirectionsResponse {
  code?: number;
  message?: string;
  route?: {
    traoptimal?: TraOptimalRoute[];
    trafast?: TraOptimalRoute[];
    tracomfort?: TraOptimalRoute[];
    traavoidtoll?: TraOptimalRoute[];
    traavoidcaronly?: TraOptimalRoute[];
  };
}

// 네이버 응답에서 첫 유효한 경로를 꺼낸다. option 별로 키가 다르므로 순회.
function pickRoute(data: DirectionsResponse): TraOptimalRoute | null {
  const keys: (keyof NonNullable<DirectionsResponse["route"]>)[] = [
    "traoptimal",
    "trafast",
    "tracomfort",
    "traavoidtoll",
    "traavoidcaronly",
  ];
  for (const k of keys) {
    const arr = data.route?.[k];
    const best = arr?.[0];
    if (best?.summary?.duration) return best;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const fromLat = req.nextUrl.searchParams.get("fromLat");
  const fromLng = req.nextUrl.searchParams.get("fromLng");
  const toLat = req.nextUrl.searchParams.get("toLat");
  const toLng = req.nextUrl.searchParams.get("toLng");

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return NextResponse.json({ error: "fromLat/fromLng/toLat/toLng required" }, { status: 400 });
  }

  const clientId = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID;
  const clientSecret = process.env.NCP_MAP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "NCP Maps 키가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  // NCP Maps Directions 5 (2024~ 신 엔드포인트)
  // option 을 여러 개 요청 — 한 개가 실패해도 다른 게 성공할 수 있음.
  // (짧은 도심 구간에서는 traoptimal 이 비는 경우가 있음.)
  const url =
    `https://maps.apigw.ntruss.com/map-direction/v1/driving` +
    `?start=${fromLng},${fromLat}&goal=${toLng},${toLat}` +
    `&option=trafast:traoptimal:tracomfort`;

  console.log(`[naver directions] request (${fromLng},${fromLat}) → (${toLng},${toLat})`);
  const res = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
    cache: "no-store",
  });

  const bodyText = await res.text();
  console.log(`[naver directions] status=${res.status} bytes=${bodyText.length}`);

  // non-2xx — 네이버가 준 status 와 body 전체를 그대로 전달.
  // NCP Maps 는 인증/권한 에러를 401/403 으로 주고, 그 body 에 구체적 사유 포함.
  if (!res.ok) {
    console.warn(`[naver directions] ${res.status}`, bodyText.slice(0, 400));
    return NextResponse.json(
      {
        error: `Naver Directions ${res.status}`,
        naverStatus: res.status,
        naverBody: bodyText.slice(0, 800),
        hint: res.status === 401 || res.status === 403
          ? "NCP Console 에서 'Directions 5' 서비스가 구독/활성화 되어 있는지 확인하세요."
          : undefined,
      },
      { status: res.status === 401 || res.status === 403 ? res.status : 502 }
    );
  }

  // 200 인데 body 비었음 — NCP 가 자주 쓰는 미스테리 응답. 경험상 원인은
  // (1) Directions 5 서비스가 NCP 콘솔에서 "신청·활성화" 되지 않음  ← 가장 흔함
  // (2) API 키가 Maps(렌더링) 권한만 있고 Directions(경로) 권한 없음
  // (3) 특정 좌표 쌍이 도로망 밖에 있거나 내부 제약
  // (1)·(2) 는 네이버클라우드 콘솔 → Services → Maps → Directions 5 활성화로 해결.
  if (!bodyText) {
    console.warn("[naver directions] empty body (200 OK) — 구독·권한 의심");
    return NextResponse.json(
      {
        error: "네이버가 빈 응답을 반환",
        naverStatus: 200,
        hint:
          "가장 흔한 원인: NCP 콘솔에서 'Directions 5' 서비스가 신청·활성화 되지 않음. " +
          "또는 API 키가 Maps 렌더링 전용이고 Directions 권한이 없음. " +
          "https://console.ncloud.com → Services → AI·NAVER API → Maps → 'Directions 5' 신청 확인 필요.",
      },
      { status: 404 }
    );
  }

  let data: DirectionsResponse;
  try {
    data = JSON.parse(bodyText) as DirectionsResponse;
  } catch {
    return NextResponse.json(
      { error: "경로 응답 파싱 실패", raw: bodyText.slice(0, 400) },
      { status: 502 }
    );
  }

  // 네이버 응답 code !== 0 이면 이유가 있음 → 그대로 반환해 디버깅 가능하게
  if (typeof data.code === "number" && data.code !== 0) {
    console.warn("[naver directions]", data.code, data.message);
    return NextResponse.json(
      {
        error: `네이버 (code ${data.code}): ${data.message ?? "경로 없음"}`,
        naverCode: data.code,
        naverMessage: data.message,
      },
      { status: 404 }
    );
  }

  const best = pickRoute(data);
  if (!best?.summary?.duration) {
    const dump = JSON.stringify(data).slice(0, 600);
    console.warn("[naver directions] 경로 데이터 없음", dump);
    return NextResponse.json(
      { error: "경로를 계산할 수 없습니다.", naverResponse: dump },
      { status: 404 }
    );
  }

  return NextResponse.json({
    durationSec: Math.round(best.summary.duration / 1000),
    path: best.path ?? [],
  });
}

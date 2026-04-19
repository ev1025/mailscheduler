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
  };
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
  const url =
    `https://maps.apigw.ntruss.com/map-direction/v1/driving` +
    `?start=${fromLng},${fromLat}&goal=${toLng},${toLat}&option=traoptimal`;

  const res = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const msg = await res.text();
    return NextResponse.json(
      { error: `Naver Directions ${res.status}: ${msg}` },
      { status: res.status }
    );
  }

  const data = (await res.json()) as DirectionsResponse;
  const best = data.route?.traoptimal?.[0];
  if (!best?.summary?.duration) {
    return NextResponse.json({ error: "경로를 계산할 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    durationSec: Math.round(best.summary.duration / 1000),
    path: best.path ?? [],
  });
}

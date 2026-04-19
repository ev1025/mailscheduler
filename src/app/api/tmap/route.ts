import { NextRequest, NextResponse } from "next/server";

// TMAP 대중교통 길찾기 API 프록시 (SK오픈API).
// 문서: https://openapi.sk.com/ → 지도/길찾기 → 대중교통 경로 조회
// Endpoint: POST https://apis.openapi.sk.com/transit/routes
//
// 요청: /api/tmap?fromLat=...&fromLng=...&toLat=...&toLng=...
// 응답: { durationSec: number }

export const dynamic = "force-dynamic";

interface TmapLeg {
  sectionTime?: number;
  mode?: string;
}

interface TmapItinerary {
  totalTime?: number;   // 초
  totalDistance?: number;
  transferCount?: number;
  legs?: TmapLeg[];
}

interface TmapResponse {
  metaData?: {
    plan?: { itineraries?: TmapItinerary[] };
    requestParameters?: unknown;
  };
  result?: { status?: number; message?: string };
}

export async function GET(req: NextRequest) {
  const fromLat = req.nextUrl.searchParams.get("fromLat");
  const fromLng = req.nextUrl.searchParams.get("fromLng");
  const toLat = req.nextUrl.searchParams.get("toLat");
  const toLng = req.nextUrl.searchParams.get("toLng");

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return NextResponse.json(
      { error: "fromLat/fromLng/toLat/toLng required" },
      { status: 400 }
    );
  }

  const appKey = process.env.TMAP_APP_KEY;
  if (!appKey) {
    return NextResponse.json(
      { error: "TMAP_APP_KEY 가 설정되지 않았습니다. 설정 후 재배포하세요." },
      { status: 503 }
    );
  }

  const res = await fetch("https://apis.openapi.sk.com/transit/routes", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      appKey,
    },
    body: JSON.stringify({
      startX: fromLng,
      startY: fromLat,
      endX: toLng,
      endY: toLat,
      lang: 0,
      format: "json",
      count: 1,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const msg = await res.text();
    return NextResponse.json(
      { error: `TMAP ${res.status}: ${msg}` },
      { status: res.status }
    );
  }

  const data = (await res.json()) as TmapResponse;
  const best = data.metaData?.plan?.itineraries?.[0];
  if (!best?.totalTime) {
    return NextResponse.json(
      { error: "경로를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json({ durationSec: best.totalTime });
}

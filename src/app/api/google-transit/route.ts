import { NextRequest, NextResponse } from "next/server";

// Google Maps Directions API 프록시 (대중교통 모드).
// 버스·지하철·기차 모두 지원. 한국 KTX·SRT 도 포함.
// 문서: https://developers.google.com/maps/documentation/directions/get-directions
//
// 요청: /api/google-transit?fromLat=&fromLng=&toLat=&toLng=&mode=bus|rail|train|subway
// 응답: { durationSec, path: [[lng, lat], ...] }

export const dynamic = "force-dynamic";

interface GoogleLeg {
  duration?: { value?: number };
}
interface GoogleRoute {
  legs?: GoogleLeg[];
  overview_polyline?: { points?: string };
}
interface GoogleResponse {
  status?: string;
  error_message?: string;
  routes?: GoogleRoute[];
}

// Google encoded polyline 디코더 → [[lng, lat], ...]
function decodePolyline(encoded: string): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const out: [number, number][] = [];
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    out.push([lng / 1e5, lat / 1e5]);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const fromLat = req.nextUrl.searchParams.get("fromLat");
  const fromLng = req.nextUrl.searchParams.get("fromLng");
  const toLat = req.nextUrl.searchParams.get("toLat");
  const toLng = req.nextUrl.searchParams.get("toLng");
  // mode: bus | rail | subway (→ transit_mode) | walking | driving
  const mode = req.nextUrl.searchParams.get("mode") ?? "bus";

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return NextResponse.json(
      { error: "fromLat/fromLng/toLat/toLng required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY 가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${fromLat},${fromLng}`);
  url.searchParams.set("destination", `${toLat},${toLng}`);
  // walking · driving 은 Google 의 최상위 mode 로 직접 전달.
  // bus · rail · subway · train 및 파이프(|) 결합은 transit 하위 transit_mode.
  if (mode === "walking" || mode === "driving" || mode === "bicycling") {
    url.searchParams.set("mode", mode);
  } else {
    url.searchParams.set("mode", "transit");
    url.searchParams.set("transit_mode", mode);
  }
  url.searchParams.set("language", "ko");
  url.searchParams.set("region", "kr");
  url.searchParams.set("key", apiKey);

  console.log(`[google-transit] mode=${mode} (${fromLat},${fromLng})→(${toLat},${toLng})`);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    console.warn(`[google-transit] HTTP ${res.status}:`, body.slice(0, 300));
    return NextResponse.json(
      { error: `Google ${res.status}`, googleBody: body.slice(0, 400) },
      { status: res.status }
    );
  }
  const data = (await res.json()) as GoogleResponse;
  const topDuration = data.routes?.[0]?.legs?.[0]?.duration?.value;
  console.log(
    `[google-transit] status=${data.status} routes=${data.routes?.length ?? 0} duration=${topDuration}s`
  );

  if (data.status && data.status !== "OK") {
    console.warn(`[google-transit] ${data.status}: ${data.error_message}`);
    return NextResponse.json(
      {
        error: `Google ${data.status}`,
        googleStatus: data.status,
        googleMessage: data.error_message,
        hint:
          data.status === "ZERO_RESULTS"
            ? `mode=${mode} 에서 경로 없음. 도보면 좌표가 인도 접근 불가 지점일 수 있음. 버스/지하철은 해당 좌표에 정류장이 없을 때 발생.`
            : data.status === "REQUEST_DENIED"
              ? "API 키에 Directions API 권한이 없거나 해당 mode 가 키에 제한되어 있음."
              : undefined,
      },
      { status: data.status === "NOT_FOUND" || data.status === "ZERO_RESULTS" ? 404 : 502 }
    );
  }

  const best = data.routes?.[0];
  const durationSec = best?.legs?.[0]?.duration?.value;
  if (!durationSec) {
    return NextResponse.json({ error: "경로 없음" }, { status: 404 });
  }
  const poly = best?.overview_polyline?.points;
  const path = poly ? decodePolyline(poly) : [];
  return NextResponse.json({ durationSec, path });
}

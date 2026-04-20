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
  // bus · rail · subway 는 transit 하위 transit_mode 로 전달.
  if (mode === "walking" || mode === "driving" || mode === "bicycling") {
    url.searchParams.set("mode", mode);
  } else {
    url.searchParams.set("mode", "transit");
    url.searchParams.set("transit_mode", mode);
  }
  url.searchParams.set("language", "ko");
  url.searchParams.set("region", "kr");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json(
      { error: `Google ${res.status}` },
      { status: res.status }
    );
  }
  const data = (await res.json()) as GoogleResponse;
  if (data.status && data.status !== "OK") {
    return NextResponse.json(
      { error: `Google: ${data.status} ${data.error_message ?? ""}` },
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

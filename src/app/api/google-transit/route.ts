import { NextRequest, NextResponse } from "next/server";

// Google Maps Directions API 프록시 (대중교통 모드).
// 버스·지하철·기차 모두 지원. 한국 KTX·SRT 도 포함.
// 문서: https://developers.google.com/maps/documentation/directions/get-directions
//
// 요청: /api/google-transit?fromLat=&fromLng=&toLat=&toLng=&mode=bus|rail|train|subway
// 응답: { durationSec, path: [[lng, lat], ...] }

export const dynamic = "force-dynamic";

// 다음 평일 오전 9시 (Unix epoch sec). transit 에서 일관된 스케줄 기준.
// 양방향 비대칭(현재 시각이 막차 전후라 A→B 와 B→A 가 다르게 나오는 문제) 완화.
function nextWeekdayMorning9(): number {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  // 토/일이면 월요일까지 이동
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return Math.floor(d.getTime() / 1000);
}

interface TransitLine {
  name?: string;
  short_name?: string;
  vehicle?: { type?: string; name?: string };
}
interface TransitDetails {
  line?: TransitLine;
  departure_stop?: { name?: string };
  arrival_stop?: { name?: string };
  num_stops?: number;
}
interface GoogleStep {
  travel_mode?: string;
  transit_details?: TransitDetails;
  duration?: { value?: number };
}
interface GoogleLeg {
  duration?: { value?: number };
  steps?: GoogleStep[];
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
  // mode: bus | rail | subway (→ transit_mode) | walking | driving | transit(all)
  const mode = req.nextUrl.searchParams.get("mode") ?? "bus";
  // 선택적 출발시각 Unix epoch sec. 미지정 시 "다음 평일 오전 9시" —
  // 현재 시각으로 보내면 심야·주말 스케줄에 잡혀 양방향 결과 편차 큼.
  const departureTimeParam = req.nextUrl.searchParams.get("departure_time");
  // alternatives=1 → Google alternatives=true + transit_mode 제한 없음
  // → { routes: TransitRoute[] } (조합 경로 여러 개) 반환
  const wantAlternatives = req.nextUrl.searchParams.get("alternatives") === "1";

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
  if (wantAlternatives) {
    // 조합 경로: transit_mode 제한 안 걸어서 버스+지하철 혼합 자유.
    url.searchParams.set("mode", "transit");
    url.searchParams.set("alternatives", "true");
  } else if (mode === "walking" || mode === "driving" || mode === "bicycling") {
    url.searchParams.set("mode", mode);
  } else {
    url.searchParams.set("mode", "transit");
    url.searchParams.set("transit_mode", mode);
  }
  url.searchParams.set("language", "ko");
  url.searchParams.set("region", "kr");
  url.searchParams.set("key", apiKey);

  // transit 모드에서만 departure_time 필요 (driving/walking 은 무관).
  if (url.searchParams.get("mode") === "transit") {
    const depTime = departureTimeParam ?? String(nextWeekdayMorning9());
    url.searchParams.set("departure_time", depTime);
  }

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

  // 공용 step 추출 헬퍼 — 한 route 의 legs[0].steps 를 RouteStep[] 로 변환.
  // WALKING step 도 포함 (alternatives 모드에서 "도보 X분" 세그먼트 표시용).
  // 반환 shape 은 alternatives 유무와 무관하게 동일.
  type StepKind = "walk" | "bus" | "subway" | "train" | "tram" | "other";
  interface RouteStep {
    kind: StepKind;
    durationSec: number;
    name: string | null;
    fromStop: string | null;
    toStop: string | null;
    numStops: number | null;
  }
  function extractSteps(leg: GoogleLeg | undefined): RouteStep[] {
    const steps: RouteStep[] = [];
    for (const step of leg?.steps ?? []) {
      const dur = step.duration?.value ?? 0;
      if (step.travel_mode === "WALKING") {
        if (dur > 0) {
          steps.push({ kind: "walk", durationSec: dur, name: null, fromStop: null, toStop: null, numStops: null });
        }
        continue;
      }
      if (step.travel_mode !== "TRANSIT") continue;
      const td = step.transit_details;
      if (!td) continue;
      const vtype = (td.line?.vehicle?.type ?? "").toUpperCase();
      const kind: StepKind =
        vtype === "BUS" || vtype === "TROLLEYBUS" || vtype === "INTERCITY_BUS"
          ? "bus"
          : vtype === "SUBWAY" || vtype === "METRO_RAIL"
            ? "subway"
            : vtype === "HEAVY_RAIL" || vtype === "RAIL" || vtype === "LONG_DISTANCE_TRAIN" || vtype === "HIGH_SPEED_TRAIN"
              ? "train"
              : vtype === "TRAM" || vtype === "COMMUTER_TRAIN"
                ? "tram"
                : "other";
      const label = td.line?.short_name ?? td.line?.name ?? null;
      steps.push({
        kind,
        durationSec: dur,
        name: label,
        fromStop: td.departure_stop?.name ?? null,
        toStop: td.arrival_stop?.name ?? null,
        numStops: td.num_stops ?? null,
      });
    }
    return steps;
  }

  // alternatives 모드 — 조합 경로 여러 개 반환
  if (wantAlternatives) {
    const routes = (data.routes ?? []).map((r) => {
      const l = r.legs?.[0];
      const steps = extractSteps(l);
      const walkingSec = steps
        .filter((s) => s.kind === "walk")
        .reduce((acc, s) => acc + s.durationSec, 0);
      const poly = r.overview_polyline?.points;
      return {
        durationSec: l?.duration?.value ?? 0,
        walkingSec,
        path: poly ? decodePolyline(poly) : [],
        steps,
      };
    }).filter((r) => r.durationSec > 0);
    if (routes.length === 0) {
      return NextResponse.json({ error: "경로 없음" }, { status: 404 });
    }
    return NextResponse.json({ routes });
  }

  const best = data.routes?.[0];
  const leg = best?.legs?.[0];
  // Google Maps 앱 UI 와 동일한 "이동 소요시간" = duration.value.
  // (arrival_time - departure_time 은 첫 차 대기시간까지 포함 → 실제보다 5~10분 길게 나옴)
  const realDurationSec = leg?.duration?.value;
  if (!realDurationSec || realDurationSec <= 0) {
    return NextResponse.json({ error: "경로 없음" }, { status: 404 });
  }

  // 기존 호환 — 단일 경로의 transit-only segments 반환 (walking 제외).
  const allSteps = extractSteps(leg);
  const segments = allSteps
    .filter((s) => s.kind !== "walk")
    .map((s) => ({
      kind: s.kind,
      name: s.name,
      fromStop: s.fromStop,
      toStop: s.toStop,
      numStops: s.numStops,
    }));

  const poly = best?.overview_polyline?.points;
  const path = poly ? decodePolyline(poly) : [];
  return NextResponse.json({ durationSec: realDurationSec, path, segments });
}

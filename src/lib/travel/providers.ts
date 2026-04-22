import type { TransportMode } from "@/types";
import { haversineKm } from "@/lib/travel/stations";

// 구간 소요시간·경로 조회 provider.
// 통합 진입점: fetchRouteDetailed — {result, error} 반환.
// - 자가용/택시 → /api/naver/directions (NCP Directions 5)
// - 도보/버스/지하철 → /api/google-transit (Google Maps Directions)
// - 도보는 Google 실패 시 직선거리×1.3/4.5km·h 폴백 (한국 도보 데이터 불완전)

export interface TransitSegment {
  kind: "bus" | "subway" | "train" | "tram" | "other";
  name: string | null;       // "2호선", "472번", "KTX"
  fromStop: string | null;
  toStop: string | null;
  numStops: number | null;
}

export interface RouteResult {
  durationSec: number;
  path?: [number, number][]; // [[lng, lat], ...]
  /** 대중교통(버스/지하철/기차) 구간 상세 — Google transit_details 에서 파싱 */
  segments?: TransitSegment[];
}

/**
 * 조합 경로(도보+버스+지하철 혼합) 의 한 스텝.
 * 대중교통 alternatives 모드에서 도보 step 도 포함해 full sequence 표현.
 */
export interface RouteStep {
  kind: "walk" | "bus" | "subway" | "train" | "tram" | "other";
  durationSec: number;
  name: string | null;
  fromStop: string | null;
  toStop: string | null;
  numStops: number | null;
}

/** 대중교통 조합 경로 한 후보 (도보+버스+지하철 혼합). */
export interface TransitRoute {
  durationSec: number;        // 총 소요
  walkingSec: number;         // 도보 구간 합
  path?: [number, number][];
  steps: RouteStep[];
}

/**
 * 실패 원인 상세. "계산 실패" 만 보였던 UX 를 "어떤 이유로 실패" 까지 노출.
 */
export interface RouteError {
  code: string;      // REQUEST_DENIED / ZERO_RESULTS / OVER_QUERY_LIMIT / HTTP_503 / NETWORK
  message: string;   // 사용자용 한 줄 설명
}

interface RouteEndpointSpec {
  endpoint: string;
  googleMode?: string; // google-transit 의 mode 쿼리
  isGoogle: boolean;
}

// mode → 엔드포인트·쿼리 맵. switch 분기 대신 테이블로 관리.
function endpointFor(mode: TransportMode): RouteEndpointSpec | null {
  switch (mode) {
    case "car":
    case "taxi":
      return { endpoint: "/api/naver/directions", isGoogle: false };
    case "walk":
      return { endpoint: "/api/google-transit", googleMode: "walking", isGoogle: true };
    case "bus":
      return { endpoint: "/api/google-transit", googleMode: "bus", isGoogle: true };
    case "train":
      return { endpoint: "/api/google-transit", googleMode: "train|subway|rail", isGoogle: true };
    default:
      return null;
  }
}

interface GoogleFailureBody {
  error?: string;
  googleStatus?: string;
  googleMessage?: string;
}

function buildErrorMessage(
  body: GoogleFailureBody,
  httpStatus: number,
  isGoogle: boolean
): string {
  switch (body.googleStatus) {
    case "REQUEST_DENIED":
      return "Google API 권한 문제 — 키에 Directions API 허용됐는지 확인하세요";
    case "OVER_QUERY_LIMIT":
      return "Google 쿼터 초과";
    case "ZERO_RESULTS":
      return "경로 없음";
  }
  if (httpStatus === 503) {
    return isGoogle
      ? "GOOGLE_MAPS_API_KEY 미설정 (/api/diagnose-google 확인)"
      : "API 키 미설정";
  }
  return body.googleMessage ?? body.error ?? `HTTP ${httpStatus}`;
}

/** 도보 Google 실패 시 직선거리 기반 추정 폴백. 15km 초과는 null. */
function walkingEstimate(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): RouteResult | null {
  const km = haversineKm(from, to);
  if (km > 15) return null;
  return { durationSec: Math.round((km * 1.3 / 4.5) * 3600) };
}

/**
 * 결과 + 실패 원인 함께 반환. use-route-data 의 유일한 진입점.
 */
export async function fetchRouteDetailed(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TransportMode
): Promise<{ result: RouteResult | null; error?: RouteError }> {
  const spec = endpointFor(mode);
  if (!spec) {
    return { result: null, error: { code: "UNKNOWN_MODE", message: `지원하지 않는 수단: ${mode}` } };
  }

  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLng: String(from.lng),
    toLat: String(to.lat),
    toLng: String(to.lng),
  });
  if (spec.googleMode) params.set("mode", spec.googleMode);

  try {
    const res = await fetch(`${spec.endpoint}?${params.toString()}`);
    if (!res.ok) {
      let body: GoogleFailureBody = {};
      try {
        body = await res.json();
      } catch {
        /* non-JSON body */
      }
      // walk 는 Google 실패해도 거리 추정 폴백
      if (mode === "walk") {
        const est = walkingEstimate(from, to);
        if (est) return { result: est };
      }
      const code = body.googleStatus ?? `HTTP_${res.status}`;
      const message = buildErrorMessage(body, res.status, spec.isGoogle);
      return { result: null, error: { code, message } };
    }
    const j = await res.json();
    if (typeof j.durationSec !== "number") {
      return { result: null, error: { code: "NO_DURATION", message: "응답에 소요시간 없음" } };
    }
    return { result: { durationSec: j.durationSec, path: j.path, segments: j.segments } };
  } catch (e) {
    return { result: null, error: { code: "NETWORK", message: String(e) } };
  }
}

/**
 * 대중교통 조합 경로 여러 개 fetch — Google Directions alternatives=true.
 * 실패 원인 포함 반환.
 */
export async function fetchTransitAlternatives(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<{ routes: TransitRoute[] | null; error?: RouteError }> {
  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLng: String(from.lng),
    toLat: String(to.lat),
    toLng: String(to.lng),
    alternatives: "1",
  });
  try {
    const res = await fetch(`/api/google-transit?${params.toString()}`);
    if (!res.ok) {
      let body: GoogleFailureBody = {};
      try {
        body = await res.json();
      } catch {
        /* non-JSON */
      }
      const code = body.googleStatus ?? `HTTP_${res.status}`;
      const message = buildErrorMessage(body, res.status, true);
      return { routes: null, error: { code, message } };
    }
    const j = await res.json();
    if (!Array.isArray(j.routes)) {
      return { routes: null, error: { code: "NO_ROUTES", message: "응답에 경로 목록 없음" } };
    }
    return { routes: j.routes as TransitRoute[] };
  } catch (e) {
    return { routes: null, error: { code: "NETWORK", message: String(e) } };
  }
}

export function formatDuration(sec: number): string {
  const m = Math.max(0, Math.round(sec / 60));
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}시간` : `${h}시간 ${rem}분`;
}

// 분 단위 그대로 받아 "1시간 30분" 형식으로. 체류시간 표시용.
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.floor(min));
  if (m === 0) return "0분";
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}시간` : `${h}시간 ${rem}분`;
}

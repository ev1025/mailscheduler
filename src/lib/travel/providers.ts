import type { PlaceInfo, TransportMode } from "@/types";
import { haversineKm } from "@/lib/travel/stations";

// 구간 소요시간·경로 조회 provider.
// 자가용 = NCP Directions, 대중교통·기차 = ODsay(추후), 택시 = 자가용 재사용.

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
 * 실패 원인 상세. "계산 실패" 만 보였던 UX 를 "어떤 이유로 실패" 까지 노출.
 * 예: "Google REQUEST_DENIED", "Google ZERO_RESULTS", "NCP 503", "네트워크 에러"
 */
export interface RouteError {
  code: string;      // 간단 분류 (REQUEST_DENIED / ZERO_RESULTS / OVER_QUERY_LIMIT / HTTP_503 / NETWORK 등)
  message: string;   // 사용자용 한 줄 설명
}

// 자가용: NCP Directions 서버 프록시 호출
async function getDrivingDuration(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<RouteResult | null> {
  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLng: String(from.lng),
    toLat: String(to.lat),
    toLng: String(to.lng),
  });
  try {
    const res = await fetch(`/api/naver/directions?${params.toString()}`);
    if (!res.ok) return null;
    const j = await res.json();
    if (typeof j.durationSec !== "number") return null;
    return { durationSec: j.durationSec, path: j.path };
  } catch {
    return null;
  }
}

// 버스: Google Maps Directions (transit, transit_mode=bus)
async function getBusDuration(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<RouteResult | null> {
  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLng: String(from.lng),
    toLat: String(to.lat),
    toLng: String(to.lng),
    mode: "bus",
  });
  try {
    const res = await fetch(`/api/google-transit?${params.toString()}`);
    if (!res.ok) return null;
    const j = await res.json();
    if (typeof j.durationSec !== "number") return null;
    return { durationSec: j.durationSec, path: j.path, segments: j.segments };
  } catch {
    return null;
  }
}

// 도보: Google Maps Directions (walking) → 실패 시 거리 기반 추정 폴백.
// 한국은 Google 의 보행자 데이터가 불완전해 도심에서도 ZERO_RESULTS 자주 발생.
async function getWalkingDuration(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<RouteResult | null> {
  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLng: String(from.lng),
    toLat: String(to.lat),
    toLng: String(to.lng),
    mode: "walking",
  });
  try {
    const res = await fetch(`/api/google-transit?${params.toString()}`);
    if (res.ok) {
      const j = await res.json();
      if (typeof j.durationSec === "number") {
        return { durationSec: j.durationSec, path: j.path };
      }
    }
  } catch {
    // fallthrough to estimate
  }

  // 폴백 추정: 직선거리 × 1.3 (보행 우회 계수) / 4.5km·h = 초
  const km = haversineKm(from, to);
  if (km > 15) return null; // 15km 초과는 도보 의미 없음
  const estimatedSec = Math.round((km * 1.3 / 4.5) * 3600);
  return { durationSec: estimatedSec };
}

// 기차: Google transit_mode 로 train|subway|rail 동시 지정.
// Google Maps 앱 대중교통 검색 결과와 동일한 레일 계열 경로(환승·대기 포함
// 실제 체감 시간) 반환.
// 파이프(|) 구분은 Google API 공식 지원 (여러 mode 중 최적 경로).
async function getTrainDuration(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<RouteResult | null> {
  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLng: String(from.lng),
    toLat: String(to.lat),
    toLng: String(to.lng),
    mode: "train|subway|rail",
  });
  try {
    const res = await fetch(`/api/google-transit?${params.toString()}`);
    if (res.ok) {
      const j = await res.json();
      if (typeof j.durationSec === "number") {
        return { durationSec: j.durationSec, path: j.path, segments: j.segments };
      }
    }
  } catch {
    // fallthrough — Google 실패 시 KORAIL 실측만 허용
  }
  // 폴백: KORAIL 공공데이터 (실측 시간표만. 실패 시 null)
  params.delete("mode");
  try {
    const res = await fetch(`/api/public-train?${params.toString()}`);
    if (!res.ok) return null;
    const j = await res.json();
    if (typeof j.durationSec !== "number") return null;
    return { durationSec: j.durationSec };
  } catch {
    return null;
  }
}

export async function fetchRouteDuration(
  from: PlaceInfo | { lat: number; lng: number },
  to: PlaceInfo | { lat: number; lng: number },
  mode: TransportMode
): Promise<RouteResult | null> {
  switch (mode) {
    case "car":
    case "taxi":
      return getDrivingDuration(from, to);
    case "walk":
      return getWalkingDuration(from, to);
    case "bus":
      return getBusDuration(from, to);
    case "train":
      return getTrainDuration(from, to);
    default:
      return null;
  }
}

/**
 * 결과 + 실패 원인 함께 반환하는 확장 버전.
 * null 결과일 때 UI 가 "왜 실패했는지" 표시할 수 있도록 Google status/메시지 포함.
 */
export async function fetchRouteDetailed(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TransportMode
): Promise<{ result: RouteResult | null; error?: RouteError }> {
  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLng: String(from.lng),
    toLat: String(to.lat),
    toLng: String(to.lng),
  });
  const isGoogle = mode === "walk" || mode === "bus" || mode === "train";
  const endpoint =
    mode === "car" || mode === "taxi"
      ? "/api/naver/directions"
      : mode === "walk"
        ? "/api/google-transit"
        : mode === "bus"
          ? "/api/google-transit"
          : "/api/google-transit"; // train
  if (mode === "walk") params.set("mode", "walking");
  else if (mode === "bus") params.set("mode", "bus");
  else if (mode === "train") params.set("mode", "train|subway|rail");

  try {
    const res = await fetch(`${endpoint}?${params.toString()}`);
    if (!res.ok) {
      let body: { error?: string; googleStatus?: string; googleMessage?: string } = {};
      try {
        body = await res.json();
      } catch {
        /* ignore */
      }
      // walk 는 Google 실패 시 직선거리 폴백 — 한국은 Google 보행자 데이터 불완전
      if (mode === "walk") {
        const km = haversineKm(from, to);
        if (km <= 15) {
          const estimatedSec = Math.round((km * 1.3 / 4.5) * 3600);
          return { result: { durationSec: estimatedSec } };
        }
      }
      const code = body.googleStatus ?? `HTTP_${res.status}`;
      const message =
        body.googleStatus === "REQUEST_DENIED"
          ? "Google API 권한 문제 — 키에 Directions API 허용됐는지 확인하세요"
          : body.googleStatus === "OVER_QUERY_LIMIT"
            ? "Google 쿼터 초과"
            : body.googleStatus === "ZERO_RESULTS"
              ? "경로 없음"
              : res.status === 503
                ? isGoogle
                  ? "GOOGLE_MAPS_API_KEY 미설정 (/api/diagnose-google 확인)"
                  : "API 키 미설정"
                : body.googleMessage ?? body.error ?? `HTTP ${res.status}`;
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

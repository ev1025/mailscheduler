import type { PlaceInfo, TransportMode } from "@/types";
import { haversineKm } from "@/lib/travel/stations";

// 구간 소요시간·경로 조회 provider.
// 자가용 = NCP Directions, 대중교통·기차 = ODsay(추후), 택시 = 자가용 재사용.

export interface RouteResult {
  durationSec: number;
  path?: [number, number][]; // [[lng, lat], ...]
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
    return { durationSec: j.durationSec, path: j.path };
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

// 기차: Google rail 우선 (지하철·일반철도·KTX 까지 모두 포함) → 실패 시 KORAIL.
// 이전엔 KORAIL 우선이었으나 도심 구간에선 가장 가까운 KTX역에 매핑되어
// 엉뚱한 결과(0분·1분)가 나옴. Google rail 이 subway/rail 구분 없이
// 정확한 시간표 기반 소요시간 제공하므로 primary 로 사용.
async function getTrainDuration(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<RouteResult | null> {
  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLng: String(from.lng),
    toLat: String(to.lat),
    toLng: String(to.lng),
  });
  // 1차: Google Maps rail (transit_mode=rail — 전철·지하철·KTX 포함)
  params.set("mode", "rail");
  try {
    const res = await fetch(`/api/google-transit?${params.toString()}`);
    if (res.ok) {
      const j = await res.json();
      if (typeof j.durationSec === "number") {
        return { durationSec: j.durationSec, path: j.path };
      }
    }
  } catch {
    // fallthrough to KORAIL
  }
  // 2차 폴백: KORAIL 공공데이터 (KTX·SRT·ITX 도시간 열차)
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

import type { PlaceInfo, TransportMode } from "@/types";

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

// 대중교통/기차: TMAP 대중교통 API 서버 프록시.
// SK오픈API 의 무료 티어 기반 — 결제 없이 상시 사용.
async function getTransitDuration(
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
    const res = await fetch(`/api/tmap?${params.toString()}`);
    if (!res.ok) return null;
    const j = await res.json();
    if (typeof j.durationSec !== "number") return null;
    return { durationSec: j.durationSec, path: j.path };
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
    case "bus":
    case "train":
      // TMAP 대중교통은 내부 최적 경로를 반환 (버스/지하철/기차 혼합). mode 세분화 없음.
      return getTransitDuration(from, to);
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

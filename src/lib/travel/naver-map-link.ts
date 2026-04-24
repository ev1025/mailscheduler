// 네이버지도 링크·스킴 헬퍼.
// - 단일 장소: 웹 URL(https://map.naver.com/p/search/…) 로 새 탭 열기.
//   모바일에선 브라우저가 네이버지도 앱으로 자동 라우팅(Universal Link).
// - 구간 길찾기: nmap://route/{mode} 스킴으로 앱 직접 호출.
//   앱 미설치 시 아무 동작 안 함 — 필요해지면 웹 fallback 추가.

import type { TransportMode } from "@/types";

const APP_NAME = "com.mailscheduler.dashboard";

export function openPlaceInNaverMap(name: string, opts?: { lat?: number | null; lng?: number | null }) {
  if (!name && !opts?.lat) return;
  // 좌표가 있으면 좌표 기반 검색이 정확도 높음. 없으면 이름 검색.
  const q = encodeURIComponent(name || "");
  const url = `https://map.naver.com/p/search/${q}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/** 구간 길찾기 — nmap 스킴 호출. mode 는 네이버 스펙의 {car|public|walk|bicycle}. */
export function openRouteInNaverMap(args: {
  from: { lat: number; lng: number; name?: string | null };
  to: { lat: number; lng: number; name?: string | null };
  mode: TransportMode | null | undefined;
}) {
  const nmode = mapTransportModeToNaver(args.mode);
  const params = new URLSearchParams();
  params.set("slat", String(args.from.lat));
  params.set("slng", String(args.from.lng));
  if (args.from.name) params.set("sname", args.from.name);
  params.set("dlat", String(args.to.lat));
  params.set("dlng", String(args.to.lng));
  if (args.to.name) params.set("dname", args.to.name);
  params.set("appname", APP_NAME);
  const url = `nmap://route/${nmode}?${params.toString()}`;
  // location.href 로 시도 — 앱 설치 시 전환, 아니면 무반응.
  window.location.href = url;
}

function mapTransportModeToNaver(m: TransportMode | null | undefined): string {
  switch (m) {
    case "car":
    case "taxi":
      return "car";
    case "walk":
      return "walk";
    case "bus":
    case "train":
    case "transit":
      return "public";
    default:
      return "car";
  }
}

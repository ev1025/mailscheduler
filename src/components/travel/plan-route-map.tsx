"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

// 여러 마커 + 선택적 폴리라인(자가용 경로 path 있을 때)을 표시하는 지도.
// Phase A의 naver-map.tsx는 단일 좌표 전용이라, 경로맵 전용 컴포넌트 분리.

interface MapPin {
  lat: number;
  lng: number;
  label?: string;
}

// 구간(leg) 한 개 — 실제 path 있으면 실선, 없으면 인접 핀 사이 점선.
// 이 구조로 바꾸면서 "1→2 만 이어지고 2→3 부터는 끊김" 버그 해결.
interface MapLeg {
  fromIdx: number;  // pins 배열 내 출발 핀 인덱스
  toIdx: number;    // pins 배열 내 도착 핀 인덱스
  path?: [number, number][]; // 있으면 실선, 없으면 점선 fallback
}

interface Props {
  pins: MapPin[];
  // 각 leg 별 경로 정보. 없으면 인접 핀 점선 연결 안 함.
  legs?: MapLeg[];
  height?: number;
  className?: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    naver?: any;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID;

export default function PlanRouteMap({
  pins,
  legs,
  height = 240,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // 지도 인스턴스·오버레이 레퍼런스를 보관해 재생성 없이 증분 업데이트.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlaysRef = useRef<any[]>([]);

  // 네이버 SDK 가 wheel 을 document/window 레벨 capture 에서 가로채
  // stopPropagation · preventDefault 로 전부 막음. React onWheel 은 bubble
  // phase 라 전달 안 됨. → window 레벨 capture 로 최우선 선점하여 직접 처리.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.target instanceof Node) || !el.contains(e.target)) return;
      // ctrl+휠 = 브라우저 줌 — 기본 동작 허용, Naver 만 차단
      if (e.ctrlKey) {
        e.stopImmediatePropagation();
        return;
      }
      // 일반 스크롤 — 부모 스크롤 컨테이너에 직접 반영
      const scrollable =
        el.closest<HTMLElement>(".overflow-y-auto") ??
        (document.scrollingElement as HTMLElement | null);
      if (scrollable) scrollable.scrollTop += e.deltaY;
      e.stopImmediatePropagation();
      e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  // 지도 1회만 생성. pins/legs 변경 시 오버레이만 교체 → 지도 깜빡임 제거.
  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const init = () => {
      if (cancelled || !containerRef.current) return;
      const naver = window.naver;
      if (!naver?.maps) {
        timer = setTimeout(init, 50);
        return;
      }
      if (mapRef.current) return; // 이미 생성됨
      mapRef.current = new naver.maps.Map(containerRef.current, {
        center: new naver.maps.LatLng(37.5665, 126.978),
        zoom: 13,
        zoomControl: false,
        scaleControl: false,
        mapDataControl: false,
        logoControl: false,
        scrollWheel: false,
      });
      // NAVER 로고 DOM 제거 (지도 생성 직후·200ms·800ms 3중 보험)
      const killLogos = () => {
        if (!containerRef.current) return;
        containerRef.current
          .querySelectorAll("a[target=\"_blank\"]")
          .forEach((a) => ((a as HTMLElement).style.display = "none"));
      };
      killLogos();
      setTimeout(killLogos, 200);
      setTimeout(killLogos, 800);
    };

    init();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []); // 지도는 1회만 생성

  // pins · legs 변경 시 기존 오버레이 제거 후 새로 그리기 — 지도 자체는 유지
  useEffect(() => {
    const map = mapRef.current;
    const naver = window.naver;
    if (!map || !naver?.maps) return;

    // 이전 오버레이(마커·폴리라인) 제거
    for (const o of overlaysRef.current) {
      try { o.setMap(null); } catch { /* ignore */ }
    }
    overlaysRef.current = [];

    // bounds 로 화면 맞춤
    if (pins.length > 1) {
      const bounds = new naver.maps.LatLngBounds(
        new naver.maps.LatLng(pins[0].lat, pins[0].lng),
        new naver.maps.LatLng(pins[0].lat, pins[0].lng)
      );
      for (const p of pins) bounds.extend(new naver.maps.LatLng(p.lat, p.lng));
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    } else if (pins.length === 1) {
      map.setCenter(new naver.maps.LatLng(pins[0].lat, pins[0].lng));
      map.setZoom(13);
    }

    // 번호 마커
    for (let i = 0; i < pins.length; i++) {
      const p = pins[i];
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(p.lat, p.lng),
        map,
        title: p.label,
        icon: {
          content:
            `<div style="background:#3b82f6;color:#fff;border-radius:50%;width:24px;height:24px;` +
            `display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;` +
            `box-shadow:0 1px 3px rgba(0,0,0,0.3);">${i + 1}</div>`,
          anchor: new naver.maps.Point(12, 12),
        },
      });
      overlaysRef.current.push(marker);
    }

    // 구간 선
    for (const leg of legs ?? []) {
      const from = pins[leg.fromIdx];
      const to = pins[leg.toIdx];
      if (!from || !to) continue;
      const hasPath = leg.path && leg.path.length > 1;
      const line = hasPath
        ? new naver.maps.Polyline({
            path: leg.path!.map((pt) => new naver.maps.LatLng(pt[1], pt[0])),
            strokeColor: "#3b82f6",
            strokeOpacity: 0.9,
            strokeWeight: 4,
            map,
          })
        : new naver.maps.Polyline({
            path: [
              new naver.maps.LatLng(from.lat, from.lng),
              new naver.maps.LatLng(to.lat, to.lng),
            ],
            strokeColor: "#94a3b8",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            strokeStyle: "shortdash",
            map,
          });
      overlaysRef.current.push(line);
    }
  }, [pins, legs]);

  if (!CLIENT_ID) {
    return (
      <div
        className={`flex items-center justify-center rounded-md bg-muted/40 text-xs text-muted-foreground ${className || ""}`}
        style={{ height }}
      >
        NEXT_PUBLIC_NCP_MAP_CLIENT_ID 미설정
      </div>
    );
  }

  return (
    <>
      <Script
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${CLIENT_ID}`}
        strategy="afterInteractive"
      />
      <div className={`naver-map-host relative ${className || ""}`}>
        <div
          ref={containerRef}
          className="rounded-md overflow-hidden"
          style={{ height }}
        />
      </div>
    </>
  );
}

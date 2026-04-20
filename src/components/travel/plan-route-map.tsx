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

  // 네이버 SDK 가 wheel 을 capture 단계에서 가로채 preventDefault.
  // React onWheel 핸들러에서 직접 부모 스크롤 컨테이너를 찾아 deltaY 만큼
  // scrollTop 을 증가시켜 우회. 지도는 줌 못 해도 페이지 스크롤은 정상.
  const handleWheelForward = (e: React.WheelEvent) => {
    const scrollContainer =
      (e.currentTarget as HTMLElement).closest<HTMLElement>(".overflow-y-auto");
    if (scrollContainer) {
      scrollContainer.scrollTop += e.deltaY;
    } else if (document.scrollingElement) {
      document.scrollingElement.scrollTop += e.deltaY;
    }
  };

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

      // 맵 생성 또는 재사용 — 간단히 매번 새로 생성(phases 적으면 성능 OK)
      const firstPin = pins[0];
      const center = firstPin
        ? new naver.maps.LatLng(firstPin.lat, firstPin.lng)
        : new naver.maps.LatLng(37.5665, 126.978);

      const map = new naver.maps.Map(containerRef.current, {
        center,
        zoom: pins.length > 1 ? 10 : 13,
        zoomControl: false,
        scaleControl: false,
        mapDataControl: false,
        logoControl: false,
        // 마우스 휠은 페이지 스크롤에 양보. 지도 확대/축소는 +/- 터치 핀치로.
        scrollWheel: false,
      });

      // 모든 핀을 감싸는 bounds 로 자동 맞춤
      if (pins.length > 1) {
        const bounds = new naver.maps.LatLngBounds(
          new naver.maps.LatLng(pins[0].lat, pins[0].lng),
          new naver.maps.LatLng(pins[0].lat, pins[0].lng)
        );
        for (const p of pins) {
          bounds.extend(new naver.maps.LatLng(p.lat, p.lng));
        }
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      }

      for (let i = 0; i < pins.length; i++) {
        const p = pins[i];
        new naver.maps.Marker({
          position: new naver.maps.LatLng(p.lat, p.lng),
          map,
          title: p.label,
          // 순서 번호 아이콘
          icon: {
            content:
              `<div style="background:#3b82f6;color:#fff;border-radius:50%;width:24px;height:24px;` +
              `display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;` +
              `box-shadow:0 1px 3px rgba(0,0,0,0.3);">${i + 1}</div>`,
            anchor: new naver.maps.Point(12, 12),
          },
        });
      }

      // 구간별로 실제 path 있으면 실선, 없으면 from→to 점선 — 끊김 없이 연결.
      for (const leg of legs ?? []) {
        const from = pins[leg.fromIdx];
        const to = pins[leg.toIdx];
        if (!from || !to) continue;
        const hasPath = leg.path && leg.path.length > 1;
        if (hasPath) {
          const latlngs = leg.path!.map((pt) => new naver.maps.LatLng(pt[1], pt[0]));
          new naver.maps.Polyline({
            path: latlngs,
            strokeColor: "#3b82f6",
            strokeOpacity: 0.9,
            strokeWeight: 4,
            map,
          });
        } else {
          // Fallback — 핀 2점 직선 점선
          new naver.maps.Polyline({
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
        }
      }

      // NAVER 로고/저작권 DOM 을 직접 찾아 숨김. logoControl:false +
      // globals.css 전역 규칙에 더한 3중 보험. SDK 가 render 를 내부 타이머
      // 로 늦춰서 그릴 수 있어 200ms 뒤에 한 번 더 실행.
      const killLogos = () => {
        if (!containerRef.current) return;
        const anchors = containerRef.current.querySelectorAll("a[target=\"_blank\"]");
        anchors.forEach((a) => ((a as HTMLElement).style.display = "none"));
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
      <div
        className={`naver-map-host relative ${className || ""}`}
        onWheel={handleWheelForward}
      >
        <div
          ref={containerRef}
          className="rounded-md overflow-hidden"
          style={{ height }}
        />
      </div>
    </>
  );
}

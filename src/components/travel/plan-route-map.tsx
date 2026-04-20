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

interface Props {
  pins: MapPin[];
  // 여러 구간의 실제 도로 경로. 각 배열은 [[lng, lat], ...] 형태.
  // 구간별로 별도 Polyline 으로 그려 네이버 길찾기처럼 보이게 함.
  paths?: [number, number][][];
  connectPins?: boolean;     // paths 없이 핀 순서대로 점선으로만 이어줄지
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
  paths,
  connectPins = false,
  height = 240,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

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

      // 실제 도로 경로 (NCP Directions) — 구간별 파란 실선
      const validPaths = (paths ?? []).filter((p) => p && p.length > 1);
      for (const p of validPaths) {
        const latlngs = p.map((pt) => new naver.maps.LatLng(pt[1], pt[0]));
        new naver.maps.Polyline({
          path: latlngs,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map,
        });
      }
      // 도로 경로가 하나도 없는 경우에만 단순 직선 점선으로 순서 표시
      if (validPaths.length === 0 && connectPins && pins.length > 1) {
        const latlngs = pins.map((p) => new naver.maps.LatLng(p.lat, p.lng));
        new naver.maps.Polyline({
          path: latlngs,
          strokeColor: "#f97316",
          strokeOpacity: 0.85,
          strokeWeight: 3,
          strokeStyle: "shortdash",
          map,
        });
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
  }, [pins, paths, connectPins]);

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

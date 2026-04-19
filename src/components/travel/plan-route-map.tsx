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
  path?: [number, number][]; // [[lng, lat], ...] (자가용 경로)
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
  path,
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
        logoControlOptions: { position: naver.maps.Position.BOTTOM_LEFT },
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

      if (path && path.length > 1) {
        const latlngs = path.map((pt) => new naver.maps.LatLng(pt[1], pt[0]));
        new naver.maps.Polyline({
          path: latlngs,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map,
        });
      }
    };

    init();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pins, path]);

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
        ref={containerRef}
        className={`rounded-md overflow-hidden ${className || ""}`}
        style={{ height }}
      />
    </>
  );
}

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

  // 네이버 SDK 가 wheel 이벤트 preventDefault 로 페이지 스크롤/ctrl+줌 을 막음.
  // 컨테이너 레벨 capture 로는 SDK 가 document 나 window 에 리스너 걸었을 때 놓침.
  // → document 레벨 capture 로 끌어올려 지도 영역 내 wheel 이벤트에 대해
  // stopImmediatePropagation, 브라우저 기본 스크롤/줌 은 그대로 수행.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDocWheel = (e: WheelEvent) => {
      const t = e.target;
      if (t instanceof Node && el.contains(t)) {
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener("wheel", onDocWheel, { capture: true, passive: true });
    return () => document.removeEventListener("wheel", onDocWheel, { capture: true });
  }, []);

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
      <div className={`naver-map-host relative ${className || ""}`}>
        {/*
          pointer-events: none — 지도는 시각 표시만, 모든 마우스/터치 이벤트
          차단하여 페이지 스크롤 · 브라우저 줌이 항상 정상 작동.
          Naver SDK 가 document / window 레벨에서도 wheel 을 가로채는
          경우가 있어 capture-phase 리스너로도 잡히지 않아 CSS 로 차단.
          마커 클릭은 불가능해지나 경로 정보는 아래 목록에 모두 표시됨.
        */}
        <div
          ref={containerRef}
          className="rounded-md overflow-hidden pointer-events-none"
          style={{ height }}
        />
      </div>
    </>
  );
}

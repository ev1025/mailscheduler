"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

// 네이버 Dynamic Map (JavaScript SDK) 임베드.
// Script 는 최초 1회만 로드되고, 두 번째 이후 mount 에서는 onReady 가
// 호출되지 않을 수 있으므로 useEffect 에서 window.naver 를 폴링해 초기화.

interface Props {
  lat: number;
  lng: number;
  height?: number;
  zoom?: number;
  className?: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    naver?: any;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID;

export default function NaverMap({
  lat,
  lng,
  height = 220,
  zoom = 15,
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
        timer = setTimeout(init, 50); // SDK 로드 대기
        return;
      }
      // 마운트 때마다 새로운 map 인스턴스. 기존 DOM 은 재사용 안 하므로
      // 이전 인스턴스가 남아있어도 ref 교체로 GC 대상이 됨.
      const position = new naver.maps.LatLng(lat, lng);
      const map = new naver.maps.Map(containerRef.current, {
        center: position,
        zoom,
        zoomControl: false,
        scaleControl: false,
        mapDataControl: false,
        logoControl: false,
        // 마우스 휠은 페이지 스크롤에 양보 — 지도 위 휠이 지도를 줌하느라
        // 페이지가 안 움직이는 문제 방지.
        scrollWheel: false,
      });
      new naver.maps.Marker({ position, map });

      // NAVER 로고 DOM 직접 숨김 (3중 보험)
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
  }, [lat, lng, zoom]);

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
        // NCP Maps 2024~ 개편 후 신규 키는 ncpKeyId 파라미터로 인증해야 함.
        // 구 ncpClientId 는 신규 발급 키에 대해 "Open API 인증 실패" 반환.
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

"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { useAppSetting } from "@/hooks/use-app-settings";

// 네이버 Dynamic Map (JavaScript SDK) 임베드 컴포넌트.
// 여행 상세·편집 팝업에서 인터랙티브 지도가 필요할 때 사용.
// 문서: https://navermaps.github.io/maps.js.ncp/docs/tutorial-1-Getting-Started.html

interface Props {
  lat: number;
  lng: number;
  height?: number;
  zoom?: number;
  className?: string;
}

// window.naver 타입 선언은 최소한만 — any 캐스트 허용.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    naver?: any;
  }
}

export default function NaverMap({
  lat,
  lng,
  height = 220,
  zoom = 15,
  className,
}: Props) {
  const { value: clientId } = useAppSetting("ncp_map_client_id", "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!clientId) return;
    if (!containerRef.current) return;
    const naver = window.naver;
    if (!naver?.maps) return; // 스크립트 로드 전이면 onReady 가 다시 호출

    const position = new naver.maps.LatLng(lat, lng);
    if (!mapRef.current) {
      mapRef.current = new naver.maps.Map(containerRef.current, {
        center: position,
        zoom,
      });
      markerRef.current = new naver.maps.Marker({
        position,
        map: mapRef.current,
      });
    } else {
      mapRef.current.setCenter(position);
      markerRef.current?.setPosition(position);
    }
  }, [clientId, lat, lng, zoom]);

  const onReady = () => {
    if (!containerRef.current) return;
    const naver = window.naver;
    if (!naver?.maps) return;
    const position = new naver.maps.LatLng(lat, lng);
    mapRef.current = new naver.maps.Map(containerRef.current, {
      center: position,
      zoom,
    });
    markerRef.current = new naver.maps.Marker({
      position,
      map: mapRef.current,
    });
  };

  if (!clientId) {
    return (
      <div
        className={`flex items-center justify-center rounded-md bg-muted/40 text-xs text-muted-foreground ${className || ""}`}
        style={{ height }}
      >
        지도 API 키가 설정되지 않았습니다 (설정 → API)
      </div>
    );
  }

  return (
    <>
      <Script
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`}
        strategy="afterInteractive"
        onReady={onReady}
      />
      <div
        ref={containerRef}
        className={`rounded-md overflow-hidden ${className || ""}`}
        style={{ height }}
      />
    </>
  );
}

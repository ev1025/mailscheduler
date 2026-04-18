"use client";

import Image from "next/image";
import { useAppSetting } from "@/hooks/use-app-settings";

// 네이버 Static Map API 이미지 컴포넌트.
// 카드 썸네일용 — 가벼움. 인터랙티브 불필요한 곳에서 사용.
// 문서: https://api.ncloud-docs.com/docs/ai-application-service-maps-staticmap

interface Props {
  lat: number;
  lng: number;
  width?: number;
  height?: number;
  level?: number; // 1(가장 넓음) ~ 14(가장 좁음) — 네이버는 level, 13~16 근처가 동네 줌
  markerColor?: "red" | "blue" | "green";
  className?: string;
}

export default function StaticMap({
  lat,
  lng,
  width = 320,
  height = 120,
  level = 14,
  markerColor = "red",
  className,
}: Props) {
  const { value: clientId } = useAppSetting("ncp_map_client_id", "");

  if (!clientId) {
    return (
      <div
        className={`flex items-center justify-center rounded-md bg-muted/40 text-[10px] text-muted-foreground ${className || ""}`}
        style={{ width, height }}
      >
        지도 API 키 미설정
      </div>
    );
  }

  // NCP Static Map API
  // - center: "lng,lat" (경도, 위도 순서)
  // - level: 줌 레벨
  // - markers: "type:d|size:mid|color:red|pos:lng lat"
  // - Query 에 X-NCP-APIGW-API-KEY-ID 를 붙이면 GET 이미지로 받을 수 있음
  const params = new URLSearchParams({
    w: String(width),
    h: String(height),
    center: `${lng},${lat}`,
    level: String(level),
    scale: "2", // 레티나 2배
    markers: `type:d|size:mid|color:${markerColor}|pos:${lng} ${lat}`,
  });
  const src = `https://naveropenapi.apigw.ntruss.com/map-static/v2/raster?${params.toString()}&X-NCP-APIGW-API-KEY-ID=${clientId}`;

  return (
    <Image
      src={src}
      alt="지도"
      width={width}
      height={height}
      unoptimized
      className={`rounded-md object-cover ${className || ""}`}
    />
  );
}

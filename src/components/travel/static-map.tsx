"use client";

import Image from "next/image";

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

const CLIENT_ID = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID;

export default function StaticMap({
  lat,
  lng,
  width = 320,
  height = 120,
  level = 14,
  markerColor = "red",
  className,
}: Props) {
  if (!CLIENT_ID) {
    return (
      <div
        className={`flex items-center justify-center rounded-md bg-muted/40 text-[10px] text-muted-foreground ${className || ""}`}
        style={{ width, height }}
      >
        NCP_MAP_CLIENT_ID 미설정
      </div>
    );
  }

  const params = new URLSearchParams({
    w: String(width),
    h: String(height),
    center: `${lng},${lat}`,
    level: String(level),
    scale: "2",
    markers: `type:d|size:mid|color:${markerColor}|pos:${lng} ${lat}`,
  });
  const src = `https://naveropenapi.apigw.ntruss.com/map-static/v2/raster?${params.toString()}&X-NCP-APIGW-API-KEY-ID=${CLIENT_ID}`;

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

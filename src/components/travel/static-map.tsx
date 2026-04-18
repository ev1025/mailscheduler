"use client";

// 네이버 Static Map 썸네일. 브라우저는 서버 프록시(/api/naver/static-map) 에
// GET 하고, 서버가 헤더 인증으로 네이버에 호출해 이미지 바이트를 반환.
// Client Secret 이 브라우저에 노출되지 않음.

interface Props {
  lat: number;
  lng: number;
  width?: number;
  height?: number;
  level?: number;
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
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    w: String(width),
    h: String(height),
    level: String(level),
    color: markerColor,
  });
  const src = `/api/naver/static-map?${params.toString()}`;

  return (
    // next/image 는 서버 프록시 응답의 cache/stream 을 그대로 쓰는 게 나음
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="지도"
      width={width}
      height={height}
      className={`rounded-md object-cover ${className || ""}`}
    />
  );
}

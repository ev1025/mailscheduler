import { NextRequest, NextResponse } from "next/server";

// 네이버 Static Map 이미지 프록시.
// 브라우저 <img> 는 커스텀 헤더를 못 붙이므로 서버에서 헤더로 인증해
// 이미지 바이트를 그대로 흘려보낸다. Client Secret 이 브라우저에 노출되지 않음.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  const w = req.nextUrl.searchParams.get("w") || "320";
  const h = req.nextUrl.searchParams.get("h") || "120";
  const level = req.nextUrl.searchParams.get("level") || "14";
  const color = req.nextUrl.searchParams.get("color") || "red";

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }

  const clientId = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID;
  const clientSecret = process.env.NCP_MAP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "NCP Maps 키가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const params = new URLSearchParams({
    w,
    h,
    center: `${lng},${lat}`,
    level,
    scale: "2",
    markers: `type:d|size:mid|color:${color}|pos:${lng} ${lat}`,
  });

  // NCP Maps 신규 엔드포인트 (2024~ 리뉴얼). 구 naveropenapi.apigw.ntruss.com 은 권한 거부됨.
  const url = `https://maps.apigw.ntruss.com/map-static/v2/raster?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const msg = await res.text();
    return NextResponse.json(
      { error: `Naver Static Map ${res.status}: ${msg}` },
      { status: res.status }
    );
  }

  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "image/png",
      // 같은 좌표/크기 요청이면 브라우저/CDN 에서 재사용 가능하도록 캐시
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

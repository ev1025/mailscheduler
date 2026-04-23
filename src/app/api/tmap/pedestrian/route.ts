import { NextRequest, NextResponse } from "next/server";

// TMAP 보행자 경로 안내 프록시.
// 문서: https://skopenapi.readme.io/reference/%EB%B3%B4%ED%96%89%EC%9E%90-%EA%B2%BD%EB%A1%9C%EC%95%88%EB%82%B4
//
// 한국 보행자 데이터가 Google Routes v1/v2 보다 촘촘해 ZERO_RESULTS 가 거의 없음.
// 도보 우선 provider 로 사용. 실패 시 Google → NCP 체인으로 폴백.
//
// 요청: GET /api/tmap/pedestrian?fromLat=&fromLng=&toLat=&toLng=
// 응답: { durationSec, path: [[lng, lat], ...] }

export const dynamic = "force-dynamic";

// TMAP 응답은 GeoJSON FeatureCollection.
// - 첫 Point feature.properties 에 totalTime(초) / totalDistance(m)
// - 중간 LineString feature 들의 coordinates 를 순서대로 이으면 도보 폴리라인
interface TmapFeature {
  type: "Feature";
  geometry: {
    type: "Point" | "LineString";
    coordinates: number[] | number[][];
  };
  properties: {
    totalTime?: number;
    totalDistance?: number;
  };
}
interface TmapResponse {
  type?: "FeatureCollection";
  features?: TmapFeature[];
}

export async function GET(req: NextRequest) {
  const fromLat = req.nextUrl.searchParams.get("fromLat");
  const fromLng = req.nextUrl.searchParams.get("fromLng");
  const toLat = req.nextUrl.searchParams.get("toLat");
  const toLng = req.nextUrl.searchParams.get("toLng");

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return NextResponse.json(
      { error: "fromLat/fromLng/toLat/toLng required" },
      { status: 400 }
    );
  }

  const appKey = process.env.TMAP_APP_KEY;
  if (!appKey) {
    return NextResponse.json(
      { error: "TMAP_APP_KEY 가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  // TMAP 은 startName/endName 필수. 내부 사용이라 더미값 OK.
  const body = {
    startX: fromLng,
    startY: fromLat,
    endX: toLng,
    endY: toLat,
    startName: "출발지",
    endName: "도착지",
    reqCoordType: "WGS84GEO",
    resCoordType: "WGS84GEO",
    searchOption: "0", // 0: 추천(최적)
  };

  let res: Response;
  try {
    res = await fetch(
      "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          appKey,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
  } catch (e) {
    console.warn(`[tmap pedestrian] network error:`, e);
    return NextResponse.json(
      { error: "NETWORK", message: String(e) },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const text = await res.text();
    console.warn(`[tmap pedestrian] HTTP ${res.status}:`, text.slice(0, 300));
    return NextResponse.json(
      { error: `HTTP_${res.status}`, message: text.slice(0, 200) },
      { status: res.status }
    );
  }

  const data = (await res.json()) as TmapResponse;
  const features = data.features ?? [];
  if (features.length === 0) {
    console.warn(`[tmap pedestrian] features empty`);
    return NextResponse.json({ error: "ZERO_RESULTS" }, { status: 404 });
  }

  // totalTime 은 맨 첫 Point feature 에만 있음.
  let durationSec = 0;
  for (const f of features) {
    const t = f.properties?.totalTime;
    if (typeof t === "number" && t > 0) {
      durationSec = t;
      break;
    }
  }
  if (durationSec <= 0) {
    console.warn(`[tmap pedestrian] totalTime 없음`);
    return NextResponse.json({ error: "NO_DURATION" }, { status: 404 });
  }

  // LineString features 의 coordinates 를 순서대로 이어 path 구성.
  // 각 LineString 끝점 = 다음 LineString 시작점이라 중복 제거.
  const path: [number, number][] = [];
  for (const f of features) {
    if (f.geometry.type !== "LineString") continue;
    const coords = f.geometry.coordinates as number[][];
    for (const [lng, lat] of coords) {
      const last = path[path.length - 1];
      if (!last || last[0] !== lng || last[1] !== lat) {
        path.push([lng, lat]);
      }
    }
  }

  if (path.length < 2) {
    console.warn(`[tmap pedestrian] path 좌표 부족 (${path.length})`);
    return NextResponse.json({ error: "NO_PATH" }, { status: 404 });
  }

  console.log(
    `[tmap pedestrian] 성공 duration=${durationSec}s points=${path.length}`
  );
  return NextResponse.json({ durationSec, path });
}

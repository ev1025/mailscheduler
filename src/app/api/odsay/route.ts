import { NextRequest, NextResponse } from "next/server";

// ODsay LAB 대중교통 경로 API 프록시 (버스·지하철·기차).
// 문서: https://lab.odsay.com/guide/releaseReference?api=publicTransportSearch
// 요청: /api/odsay?fromLat=...&fromLng=...&toLat=...&toLng=...&mode=bus|train
// 응답: { durationSec: number } (path 는 MVP 에서 제공 안 함)

export const dynamic = "force-dynamic";

interface OdsayPath {
  info?: { totalTime?: number }; // 분
  subPath?: Array<{ trafficType?: number }>; // 1=지하철, 2=버스, 3=도보 등
}

interface OdsayResponse {
  result?: { path?: OdsayPath[] };
  error?: { message?: string; code?: string };
}

export async function GET(req: NextRequest) {
  const fromLat = req.nextUrl.searchParams.get("fromLat");
  const fromLng = req.nextUrl.searchParams.get("fromLng");
  const toLat = req.nextUrl.searchParams.get("toLat");
  const toLng = req.nextUrl.searchParams.get("toLng");
  const mode = req.nextUrl.searchParams.get("mode") ?? "bus"; // bus | train

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return NextResponse.json({ error: "fromLat/fromLng/toLat/toLng required" }, { status: 400 });
  }

  const apiKey = process.env.ODSAY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ODSAY_API_KEY 가 설정되지 않았습니다. 설정 후 재배포하세요." },
      { status: 503 }
    );
  }

  // SearchPubTransPathT: 대중교통 길찾기
  // SearchType 파라미터: 0=지하철+버스 / 1=지하철 / 2=버스
  // mode=train 은 searchPathType=1(지하철) 로 대체 — 실제 기차는 별도 KTX API 필요
  const searchPathType = mode === "train" ? "1" : "0";
  const params = new URLSearchParams({
    apiKey,
    SX: fromLng,
    SY: fromLat,
    EX: toLng,
    EY: toLat,
    SearchPathType: searchPathType,
  });

  const url = `https://api.odsay.com/v1/api/searchPubTransPathT?${params.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const msg = await res.text();
    return NextResponse.json(
      { error: `ODsay ${res.status}: ${msg}` },
      { status: res.status }
    );
  }

  const data = (await res.json()) as OdsayResponse;
  if (data.error) {
    return NextResponse.json(
      { error: `ODsay: ${data.error.message ?? "unknown"}` },
      { status: 502 }
    );
  }
  const best = data.result?.path?.[0];
  const totalTime = best?.info?.totalTime;
  if (typeof totalTime !== "number") {
    return NextResponse.json({ error: "경로를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ durationSec: totalTime * 60 });
}

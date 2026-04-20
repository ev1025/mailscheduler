import { NextRequest, NextResponse } from "next/server";

// 공공데이터포털 "열차운행정보" / "KTX·SRT 시간표" API 프록시 (기차 전용).
// 좌표 → 역명으로 변환하는 로직이 필요해 복잡. 1차 구현은 Google Maps 의
// rail mode 를 우선 쓰고(provider 에서), 이 라우트는 공공데이터 API 키가
// 채워졌을 때만 활성화되도록 슬롯만 마련. 실제 경로 계산 로직은 TODO.
//
// 예: http://openapi.kric.go.kr/openapi/... 같은 엔드포인트가 역코드 기반이라
// 좌표 → 역코드 매핑 테이블이 필요함. 한국 주요 철도역 만이라면 JSON 상수로
// 관리 가능. 구현은 키 발급 + 매핑 확보 후.
//
// 요청: /api/public-train?fromLat=&fromLng=&toLat=&toLng=
// 응답(현재): 키 없으면 503, 있어도 "구현 예정" 501 반환

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const fromLat = req.nextUrl.searchParams.get("fromLat");
  const toLat = req.nextUrl.searchParams.get("toLat");
  if (!fromLat || !toLat) {
    return NextResponse.json({ error: "좌표 필요" }, { status: 400 });
  }
  const key = process.env.PUBLIC_TRAIN_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "PUBLIC_TRAIN_API_KEY 미설정 — Google Maps rail 로 자동 폴백됩니다." },
      { status: 503 }
    );
  }
  // TODO: 좌표 → 주요 역 매핑 + 공공데이터 열차시간표 조회
  return NextResponse.json(
    { error: "공공데이터 기차 API 구현 예정. Google rail 폴백 중." },
    { status: 501 }
  );
}

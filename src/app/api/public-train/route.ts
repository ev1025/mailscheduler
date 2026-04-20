import { NextRequest, NextResponse } from "next/server";
import { findNearestStation, haversineKm } from "@/lib/travel/stations";

// 공공데이터 한국철도공사 "여객열차 운행계획" 조회.
// data.go.kr 데이터셋 15125762 — B551457/run/v2/plans 엔드포인트.
//
// 파라미터(가이드 기준):
//   serviceKey (required) — 디코딩 인증키
//   cond[run_ymd::GTE]    — 운행일자 이후 (YYYYMMDD)
//   cond[run_ymd::LTE]    — 운행일자 이전 (YYYYMMDD)
//   cond[dptre_stn_nm::EQ]— 출발역명
//   cond[arvl_stn_nm::EQ] — 도착역명
//   returnType            — JSON | XML
//
// 응답에서 열차계획출발일시 / 열차계획도착일시 차이 중 최솟값을 소요시간으로.
// API 실패 시 하버사인 × KTX 평균속도(150km/h) 추정치 폴백.

export const dynamic = "force-dynamic";

const KTX_EFFECTIVE_KMH = 150;
const PLANS_URL = "https://apis.data.go.kr/B551457/run/v2/plans";

// YYYY-MM-DD → YYYYMMDD
function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// data.go.kr 표준 응답 구조는 { response: { header, body: { items } } } 또는
// 평탄한 { items } 둘 다 대응. 또한 items 가 배열이 아닌 { item: [...] } 인
// 경우(XML-to-JSON 변환 유산)도 처리.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractItems(data: any): Record<string, unknown>[] {
  if (!data) return [];
  const body = data.response?.body ?? data;
  const items = body?.items;
  if (Array.isArray(items)) return items;
  if (items?.item) return Array.isArray(items.item) ? items.item : [items.item];
  return [];
}

// 응답 row 에서 계획 출발/도착 일시 문자열을 찾아 반환.
// 필드명 가이드에 "열차계획출발일시" 로만 적혀있고 영문 키가 확정 아님.
// 가능한 키 후보를 순회해 최초로 값 있는 걸 채택.
function pickDateTime(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

// "20260420153000" 또는 "2026-04-20 15:30:00" 또는 ISO 를 Date 로.
function parseDateTime(s: string): Date | null {
  // 순수 숫자 14자리: YYYYMMDDHHMMSS
  if (/^\d{14}$/.test(s)) {
    const y = +s.slice(0, 4);
    const mo = +s.slice(4, 6) - 1;
    const d = +s.slice(6, 8);
    const h = +s.slice(8, 10);
    const mi = +s.slice(10, 12);
    const se = +s.slice(12, 14);
    const t = new Date(y, mo, d, h, mi, se);
    return Number.isNaN(t.getTime()) ? null : t;
  }
  // 12자리(초 없음): YYYYMMDDHHMM
  if (/^\d{12}$/.test(s)) {
    const y = +s.slice(0, 4);
    const mo = +s.slice(4, 6) - 1;
    const d = +s.slice(6, 8);
    const h = +s.slice(8, 10);
    const mi = +s.slice(10, 12);
    const t = new Date(y, mo, d, h, mi);
    return Number.isNaN(t.getTime()) ? null : t;
  }
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t;
}

export async function GET(req: NextRequest) {
  const fromLat = parseFloat(req.nextUrl.searchParams.get("fromLat") ?? "");
  const fromLng = parseFloat(req.nextUrl.searchParams.get("fromLng") ?? "");
  const toLat = parseFloat(req.nextUrl.searchParams.get("toLat") ?? "");
  const toLng = parseFloat(req.nextUrl.searchParams.get("toLng") ?? "");

  if ([fromLat, fromLng, toLat, toLng].some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: "좌표 필요" }, { status: 400 });
  }

  const key = process.env.PUBLIC_TRAIN_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "PUBLIC_TRAIN_API_KEY 미설정 — Google Maps rail 로 자동 폴백됩니다." },
      { status: 503 }
    );
  }

  const fromStation = findNearestStation({ lat: fromLat, lng: fromLng });
  const toStation = findNearestStation({ lat: toLat, lng: toLng });

  if (!fromStation || !toStation) {
    return NextResponse.json(
      {
        error: "출발지·도착지 근처에 KTX/SRT 역이 없습니다.",
        fromStation: fromStation?.name ?? null,
        toStation: toStation?.name ?? null,
      },
      { status: 404 }
    );
  }

  if (fromStation.code === toStation.code) {
    return NextResponse.json({
      durationSec: 0,
      fromStation: fromStation.name,
      toStation: toStation.name,
      estimated: false,
      distanceKm: 0,
    });
  }

  const estimateSec = Math.round(
    (haversineKm(fromStation, toStation) / KTX_EFFECTIVE_KMH) * 3600
  );

  // 운행계획 API 호출 — 오늘 ~ 30일 이내 구간.
  // cond[] 키는 URL 인코딩되면 'cond%5Brun_ymd%3A%3AGTE%5D' 가 되므로
  // URLSearchParams 에 raw 문자열로 넣음.
  const params = new URLSearchParams();
  params.append("serviceKey", key); // 디코딩 키 — URLSearchParams 가 인코딩
  params.append("pageNo", "1");
  params.append("numOfRows", "50");
  params.append("returnType", "JSON");
  params.append("cond[run_ymd::GTE]", todayYmd());
  params.append("cond[dptre_stn_nm::EQ]", fromStation.name);
  params.append("cond[arvl_stn_nm::EQ]", toStation.name);

  let apiError: string | null = null;
  let rawItems: Record<string, unknown>[] = [];
  try {
    const url = `${PLANS_URL}?${params.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) {
      apiError = `HTTP ${res.status}: ${text.slice(0, 200)}`;
    } else {
      try {
        const data = JSON.parse(text);
        rawItems = extractItems(data);
      } catch {
        apiError = `응답 파싱 실패: ${text.slice(0, 200)}`;
      }
    }
  } catch (e) {
    apiError = `네트워크 오류: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 계획출발일시/도착일시 차이 중 최솟값(초)
  let minDurationSec: number | null = null;
  const depKeys = [
    "plan_dptre_dt",
    "pln_dptre_dt",
    "dptre_plan_dt",
    "dep_plan_dt",
    "dptre_dt",
    "dprtre_dt",
    "trn_plan_dptre_dt",
  ];
  const arvKeys = [
    "plan_arvl_dt",
    "pln_arvl_dt",
    "arvl_plan_dt",
    "arv_plan_dt",
    "arvl_dt",
    "trn_plan_arvl_dt",
  ];
  for (const row of rawItems) {
    const dep = pickDateTime(row, depKeys);
    const arv = pickDateTime(row, arvKeys);
    if (!dep || !arv) continue;
    const dDep = parseDateTime(dep);
    const dArv = parseDateTime(arv);
    if (!dDep || !dArv) continue;
    const diff = Math.round((dArv.getTime() - dDep.getTime()) / 1000);
    if (diff > 0 && (minDurationSec == null || diff < minDurationSec)) {
      minDurationSec = diff;
    }
  }

  if (minDurationSec != null) {
    return NextResponse.json({
      durationSec: minDurationSec,
      fromStation: fromStation.name,
      toStation: toStation.name,
      estimated: false,
      matchedTrains: rawItems.length,
    });
  }

  // API 실패 또는 데이터 없음 → 추정치로 폴백
  if (apiError) console.warn("[public-train]", apiError);
  return NextResponse.json({
    durationSec: estimateSec,
    fromStation: fromStation.name,
    toStation: toStation.name,
    estimated: true,
    distanceKm: Math.round(haversineKm(fromStation, toStation) * 10) / 10,
    note:
      rawItems.length === 0
        ? "운행계획 조회 결과 없음 (필드명 불일치 가능) — 추정치 반환"
        : "열차 데이터는 받았으나 일시 필드 파싱 실패 — 추정치 반환",
    apiError: apiError ?? undefined,
    sampleRow: rawItems[0] ?? undefined,
  });
}

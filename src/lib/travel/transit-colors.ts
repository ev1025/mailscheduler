// 이동수단·노선별 지도 폴리라인 색상 매핑.
// 사용처: plan-detail → plan-route-map 폴리라인 strokeColor.
//
// 지하철 호선별 공식 심볼 컬러(서울교통공사·KORAIL 기준) 사용.
// 이름에서 호선 식별 불가 시 모드 기본색으로 폴백.

import type { TransportMode } from "@/types";
import type { TransportRouteStep } from "@/types";

// 지하철 호선명 → 공식 색상.
// "N호선" / "신분당선" / "공항철도" 등 흔한 표기 수용.
const SUBWAY_LINE_COLORS: { match: RegExp; color: string }[] = [
  { match: /\b1호선|경부|경인|장항/, color: "#0052A4" },
  { match: /\b2호선/, color: "#00A84D" },
  { match: /\b3호선/, color: "#EF7C1C" },
  { match: /\b4호선/, color: "#00A5DE" },
  { match: /\b5호선/, color: "#996CAC" },
  { match: /\b6호선/, color: "#CD7C2F" },
  { match: /\b7호선/, color: "#747F00" },
  { match: /\b8호선/, color: "#E6186C" },
  { match: /\b9호선/, color: "#BB8336" },
  { match: /신분당/, color: "#D4003B" },
  { match: /경의(중앙)?|중앙선/, color: "#77C4A3" },
  { match: /공항철도|AREX/i, color: "#0090D2" },
  { match: /수인|분당/, color: "#FABE00" },
  { match: /김포|골드/, color: "#A17800" },
  { match: /서해/, color: "#88AD1F" },
  { match: /경춘/, color: "#0C8E72" },
  { match: /경강/, color: "#003DA5" },
  { match: /우이신설|우이/, color: "#B7C452" },
  { match: /신림/, color: "#6789CA" },
];

function subwayColorFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  for (const { match, color } of SUBWAY_LINE_COLORS) {
    if (match.test(name)) return color;
  }
  return null;
}

// 이동수단 기본 색상 — 노선 식별 실패 시.
const MODE_DEFAULTS: Record<string, string> = {
  walk: "#64748B",   // 슬레이트
  car: "#3B82F6",    // 파랑 (기본)
  taxi: "#F59E0B",   // 앰버
  bus: "#3D5BAA",    // 서울 시내버스 파랑
  subway: "#00A84D", // 2호선 녹색(기본)
  train: "#DC2626",  // KTX·일반 기차 빨강
  tram: "#8B5CF6",   // 보라
  transit: "#3B82F6",
};

/**
 * leg 한 구간의 폴리라인 색상 결정.
 * 1) train(=지하철 포함) → transport_route 첫 transit step 의 name 에서 호선 색 탐지
 * 2) 실패 시 mode 기본색
 * 3) mode 없으면 파랑(기본)
 *
 * NOTE: TransportMode 에 "subway" 는 없음 — 지하철·기차 모두 "train" 으로 통합.
 * 세부 지하철 호선 구분은 transport_route step 의 kind="subway" 로 함.
 */
export function colorForLeg(
  mode: TransportMode | null | undefined,
  route: TransportRouteStep[] | null | undefined
): string {
  if (!mode) return "#3B82F6";

  if (mode === "train") {
    const firstTransit = route?.find(
      (s) => s.kind === "subway" || s.kind === "train" || s.kind === "tram"
    );
    const lineColor = subwayColorFromName(firstTransit?.name);
    if (lineColor) return lineColor;
  }

  // 버스도 route 안에 여러 번호 있으면 첫 번호의 색 쓸 수 있지만,
  // 서울 시내버스는 번호별이 아닌 차종별(간선/지선/광역) 로 달라 이름만으론 판단 불확실.
  // 일단 모드 기본색 통일.
  return MODE_DEFAULTS[mode] ?? "#3B82F6";
}

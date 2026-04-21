// 한국 대중교통(서울 중심) 노선 색상 — Google transit_details 의 line.short_name/name
// 에서 호선·버스번호를 파싱해 공식 컬러 반환.

// 서울 지하철·광역철도 공식 라인 컬러.
// 자료: Seoul Metro / 코레일 / 민자운영사 공식 가이드라인 기준.
const SUBWAY_LINE_COLORS: Record<string, string> = {
  "1": "#0052A4",
  "2": "#00A84D",
  "3": "#EF7C1C",
  "4": "#00A5DE",
  "5": "#996CAC",
  "6": "#CD7C2F",
  "7": "#747F00",
  "8": "#E6186C",
  "9": "#BDB092",
  KTX: "#CE0E2D",
  SRT: "#6A1B9A",
  공항철도: "#0090D2",
  신분당선: "#D4003B",
  분당선: "#FABE00",
  수인분당선: "#FABE00",
  경의중앙선: "#77C4A3",
  경춘선: "#0C8E72",
  수인선: "#F5A200",
  서해선: "#8FC31F",
  신림선: "#6789CA",
  우이신설선: "#B7C452",
  의정부경전철: "#FDA600",
  용인경전철: "#509F22",
  인천1호선: "#7CA8D5",
  인천2호선: "#ED8B00",
  김포골드라인: "#AE8949",
  GTX: "#003366",
};

// 서울 시내버스 번호 체계별 컬러.
//  - 파랑(간선): 두 자리 지역번호 + 한 자리 노선 (XYZ, 100~699 대역)
//  - 초록(지선): 네 자리 (1000번대)
//  - 빨강(광역): N000~N999 (9xxx 등)
//  - 노랑(순환): 두 자리 01~05
//  - 녹색(마을): 지역약자 + 두 자리 (은평05 등) — green 보다 진녹
const BUS_BLUE = "#3377FF";
const BUS_GREEN = "#6FAA38";
const BUS_RED = "#E4032E";
const BUS_YELLOW = "#F5B327";
const BUS_VILLAGE = "#5DB761";
const BUS_INTERCITY = "#4A4A4A";

export function subwayLineColor(name: string | null | undefined): string {
  if (!name) return "#6B7280";
  const n = name.trim();

  // "1호선", "2호선" 등 숫자 호선
  const m = /^([1-9])호선$/.exec(n);
  if (m) return SUBWAY_LINE_COLORS[m[1]] ?? "#6B7280";

  // 이름 직접 매치 (신분당선, 경의중앙선 등)
  if (SUBWAY_LINE_COLORS[n]) return SUBWAY_LINE_COLORS[n];

  // 부분 매치 (이름에 키워드 포함)
  for (const key of Object.keys(SUBWAY_LINE_COLORS)) {
    if (n.includes(key) && isNaN(Number(key))) return SUBWAY_LINE_COLORS[key];
  }

  return "#6B7280";
}

// 호선 원형 배지에 표기할 짧은 라벨: "1호선" → "1", "신분당선" → "신분당", "KTX" → "KTX"
export function subwayBadgeLabel(name: string | null | undefined): string {
  if (!name) return "";
  const n = name.trim();
  const m = /^([1-9])호선$/.exec(n);
  if (m) return m[1];
  // "신분당선" 같이 길면 마지막 "선" 제거해 4자 이내로
  if (n.endsWith("선")) {
    const base = n.slice(0, -1);
    return base.length <= 4 ? base : base.slice(0, 3);
  }
  return n.length <= 4 ? n : n.slice(0, 3);
}

// 정류장·역 이름 정리.
// Google 이 반환하는 name 은 보통 "장승배기역.상도2치안센터" 같이 "." 으로
// 랜드마크를 붙여 지저분. 또 "7호선 장승배기역" 같이 호선 prefix 포함되기도.
//  - "." 기준 앞부분만 취함 (주 정류장 이름)
//  - "1호선 " ~ "9호선 " 같은 호선 prefix 제거 (배지가 이미 표시하므로 중복)
//  - 앞뒤 공백 정리
export function cleanStopName(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.trim();
  // "." 이나 "," 있으면 앞부분만
  const cutters = [".", ","];
  for (const c of cutters) {
    const idx = s.indexOf(c);
    if (idx > 0) s = s.slice(0, idx).trim();
  }
  // 괄호로 부연설명 있는 경우 앞만 — "장승배기역(7호선)" → "장승배기역"
  const pIdx = s.search(/[(（]/);
  if (pIdx > 0) s = s.slice(0, pIdx).trim();
  // "1호선 " ~ "9호선 " prefix + 한글 호선명 prefix 제거
  s = s.replace(/^[1-9]호선\s+/, "");
  s = s.replace(/^(KTX|SRT|공항철도|신분당선|분당선|수인분당선|경의중앙선|경춘선|신림선|우이신설선|의정부경전철|용인경전철|인천[12]호선|김포골드라인|GTX[-\s]?[A-D]?)\s+/, "");
  return s;
}

// 서울 버스 체계 분류 → 컬러. number 가 정확한 정수 번호일 때만 구분.
export function busColor(name: string | null | undefined): string {
  if (!name) return BUS_INTERCITY;
  const raw = name.trim();
  // 숫자만 추출
  const digits = raw.match(/\d+/)?.[0];
  if (!digits) {
    // "송파08" 같이 지역명 + 숫자 → 마을버스
    if (/[가-힣]+\d+/.test(raw)) return BUS_VILLAGE;
    return BUS_INTERCITY;
  }
  const n = parseInt(digits, 10);
  // 광역(M·N 심야·9xxx 직행좌석 등)
  if (/^[MN]/i.test(raw) || n >= 9000) return BUS_RED;
  // 순환 (01~05)
  if (digits.length === 2 && n >= 1 && n <= 99 && n < 20) return BUS_YELLOW;
  // 지선 (4자리)
  if (digits.length === 4) return BUS_GREEN;
  // 간선 (2~3자리, 100~699 대역은 대부분 간선)
  if (n >= 100 && n <= 799) return BUS_BLUE;
  // 나머지 (시외·좌석 등)
  return BUS_INTERCITY;
}

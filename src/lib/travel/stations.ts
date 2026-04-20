// 국내 KTX·SRT 주요 역 좌표 + KORAIL 역코드.
// 좌표 출처: 네이버 지도로 확인한 역 중심점.
// 역코드: KORAIL 공공데이터 API 가 쓰는 7자리 역코드(NAT0xxxxx).
//         정확한 코드는 실제 API 문서 확인 후 수정 권장.

export interface Station {
  name: string;
  lat: number;
  lng: number;
  // KORAIL 공공데이터 API 에서 쓰는 역코드(운영사마다 다름).
  // SRT 전용역(수서·동탄·지제)은 별도 체계지만 KORAIL API 에서도 조회 가능.
  code: string;
}

export const STATIONS: Station[] = [
  // 경부선 (KTX·SRT)
  { name: "서울", lat: 37.5547, lng: 126.9707, code: "NAT010000" },
  { name: "용산", lat: 37.5299, lng: 126.9650, code: "NAT010032" },
  { name: "수서", lat: 37.4870, lng: 127.1012, code: "SRT000001" },
  { name: "광명", lat: 37.4163, lng: 126.8846, code: "NAT010091" },
  { name: "천안아산", lat: 36.7949, lng: 127.1045, code: "NAT010322" },
  { name: "오송", lat: 36.6197, lng: 127.3266, code: "NAT010408" },
  { name: "대전", lat: 36.3321, lng: 127.4345, code: "NAT010529" },
  { name: "김천구미", lat: 36.1128, lng: 128.1744, code: "NAT010722" },
  { name: "동대구", lat: 35.8795, lng: 128.6286, code: "NAT010857" },
  { name: "신경주", lat: 35.7980, lng: 129.1298, code: "NAT011160" },
  { name: "울산", lat: 35.5504, lng: 129.1383, code: "NAT011242" },
  { name: "부산", lat: 35.1148, lng: 129.0402, code: "NAT011668" },

  // 호남선 · 전라선
  { name: "익산", lat: 35.9353, lng: 126.9554, code: "NAT030057" },
  { name: "정읍", lat: 35.5724, lng: 126.8523, code: "NAT030187" },
  { name: "광주송정", lat: 35.1347, lng: 126.7894, code: "NAT030363" },
  { name: "목포", lat: 34.7854, lng: 126.3817, code: "NAT030545" },
  { name: "전주", lat: 35.8506, lng: 127.1209, code: "NAT050083" },
  { name: "남원", lat: 35.4109, lng: 127.3913, code: "NAT050251" },
  { name: "여수엑스포", lat: 34.7491, lng: 127.7500, code: "NAT050493" },

  // SRT 전용 · 수도권
  { name: "동탄", lat: 37.2008, lng: 127.0747, code: "SRT000002" },
  { name: "지제", lat: 37.0762, lng: 127.1008, code: "SRT000003" },

  // 강릉선 · 기타
  { name: "평창", lat: 37.5540, lng: 128.3892, code: "NAT630089" },
  { name: "강릉", lat: 37.7641, lng: 128.8994, code: "NAT630132" },
  { name: "청량리", lat: 37.5801, lng: 127.0466, code: "NAT130068" },
  { name: "원주", lat: 37.3378, lng: 127.9590, code: "NAT620134" },
  { name: "안동", lat: 36.5669, lng: 128.6967, code: "NAT620311" },
];

// 하버사인 거리 (km)
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 좌표 근처의 가장 가까운 역. 임계거리(km) 초과면 null.
export function findNearestStation(
  point: { lat: number; lng: number },
  maxKm: number = 15
): Station | null {
  let best: Station | null = null;
  let bestDist = Infinity;
  for (const s of STATIONS) {
    const d = haversineKm(point, s);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best && bestDist <= maxKm ? best : null;
}

-- 여행/데이트 항목에 네이버 지도 연동용 위치(장소) 정보 컬럼 추가
-- Supabase SQL Editor 에서 한 번 실행하세요.

ALTER TABLE travel_items
  ADD COLUMN IF NOT EXISTS place_name TEXT,        -- 네이버 검색 결과의 "title" (HTML 태그 제거 후)
  ADD COLUMN IF NOT EXISTS address TEXT,           -- 도로명 또는 지번 주소
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,   -- 위도 (예: 37.5665)
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;   -- 경도 (예: 126.9780)

-- 기존 region 컬럼은 호환을 위해 유지 — 새 place_name 이 비어있으면 region 을 대신 표시.
-- 향후 제거하려면 백필 후 DROP.

-- 좌표 기반 범위 검색 용도의 인덱스 (추후 "현재 위치 주변" 기능 대비)
CREATE INDEX IF NOT EXISTS idx_travel_items_latlng
  ON travel_items (lat, lng);

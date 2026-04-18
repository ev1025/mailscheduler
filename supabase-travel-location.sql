-- 여행/데이트 항목에 네이버 지도 연동용 위치 정보 컬럼
-- Supabase SQL Editor 에서 한 번 실행.

-- 1) (이전 리비전) 단일 장소용 컬럼 — 호환을 위해 유지
ALTER TABLE travel_items
  ADD COLUMN IF NOT EXISTS place_name TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- 2) 여러 장소를 태그하기 위한 배열 컬럼 (JSON)
-- 구조: [{ "name": "...", "address": "...", "lat": 0, "lng": 0 }, ...]
ALTER TABLE travel_items
  ADD COLUMN IF NOT EXISTS places JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3) 기존 단일 장소가 있는 행의 데이터를 places 배열로 복사
-- (idempotent: places 가 아직 비어 있을 때만 채움)
UPDATE travel_items
SET places = jsonb_build_array(
  jsonb_build_object(
    'name', place_name,
    'address', address,
    'lat', lat,
    'lng', lng
  )
)
WHERE place_name IS NOT NULL
  AND (places IS NULL OR places = '[]'::jsonb);

-- 4) 좌표 인덱스 (단일 컬럼용 — 기존 리비전)
CREATE INDEX IF NOT EXISTS idx_travel_items_latlng
  ON travel_items (lat, lng);

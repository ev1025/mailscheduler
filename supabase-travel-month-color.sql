-- 여행 항목에 시기(월), 색상 컬럼 추가
ALTER TABLE travel_items ADD COLUMN IF NOT EXISTS month INTEGER;
ALTER TABLE travel_items ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

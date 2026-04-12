-- ============================================
-- 태그 기능 추가: Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 태그 테이블 생성
CREATE TABLE event_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 태그 삽입
INSERT INTO event_tags (name, color) VALUES
  ('데이트', '#EC4899'),
  ('약속', '#F59E0B'),
  ('회사', '#3B82F6'),
  ('개인', '#22C55E'),
  ('운동', '#06B6D4'),
  ('여행', '#A855F7');

-- 2. calendar_events에 tag, repeat 컬럼 추가
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS tag TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS repeat TEXT CHECK (repeat IN ('weekly', 'monthly', 'yearly'));

-- 3. 태그 테이블 보안 정책
ALTER TABLE event_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON event_tags FOR ALL TO anon USING (true) WITH CHECK (true);

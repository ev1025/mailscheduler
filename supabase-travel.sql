-- 여행/놀거리 테이블: Supabase SQL Editor에서 실행

CREATE TABLE travel_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  in_season BOOLEAN DEFAULT FALSE,
  region TEXT,
  category TEXT NOT NULL CHECK (category IN ('자연', '숙소', '식당', '놀거리', '기타')),
  visited BOOLEAN DEFAULT FALSE,
  tag TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_travel_items_visited ON travel_items(visited);
CREATE INDEX idx_travel_items_category ON travel_items(category);

-- 여행 태그 (이벤트 태그와 별도)
CREATE TABLE travel_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO travel_tags (name, color) VALUES
  ('벚꽃', '#FBCFE8'),
  ('불꽃놀이', '#F87171'),
  ('드론', '#60A5FA'),
  ('단풍', '#FB923C'),
  ('야경', '#A78BFA'),
  ('한정메뉴', '#FBBF24');

-- RLS
ALTER TABLE travel_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON travel_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON travel_tags FOR ALL TO anon USING (true) WITH CHECK (true);

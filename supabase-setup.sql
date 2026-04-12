-- ============================================
-- 이 SQL을 Supabase SQL Editor에 통째로 붙여넣고 Run 하세요
-- ============================================

-- 1. 캘린더 이벤트
CREATE TABLE calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_calendar_events_start_date ON calendar_events(start_date);

-- 2. 지출/수입 카테고리
CREATE TABLE expense_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT DEFAULT '#6B7280',
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO expense_categories (name, icon, color, type) VALUES
  ('급여', 'banknote', '#22C55E', 'income'),
  ('부수입', 'coins', '#10B981', 'income'),
  ('용돈', 'wallet', '#14B8A6', 'income'),
  ('기타수입', 'plus-circle', '#06B6D4', 'income'),
  ('식비', 'utensils', '#EF4444', 'expense'),
  ('교통비', 'car', '#F97316', 'expense'),
  ('쇼핑', 'shopping-bag', '#A855F7', 'expense'),
  ('주거비', 'home', '#6366F1', 'expense'),
  ('통신비', 'smartphone', '#8B5CF6', 'expense'),
  ('의료비', 'heart-pulse', '#EC4899', 'expense'),
  ('문화생활', 'ticket', '#F59E0B', 'expense'),
  ('카페/간식', 'coffee', '#D97706', 'expense'),
  ('구독료', 'repeat', '#0EA5E9', 'expense'),
  ('기타지출', 'minus-circle', '#6B7280', 'expense');

-- 3. 거래 내역 (가계부)
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount INTEGER NOT NULL,
  category_id UUID REFERENCES expense_categories(id),
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  payment_method TEXT DEFAULT '카드' CHECK (payment_method IN ('현금', '카드', '계좌이체', '기타')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_expenses_date ON expenses(date);

-- 4. 메모
CREATE TABLE memos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_memos_pinned_updated ON memos(pinned DESC, updated_at DESC);

-- 5. 영양제 비교
CREATE TABLE supplements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  price INTEGER,
  ranking INTEGER,
  link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 날씨 캐시
CREATE TABLE weather_cache (
  date DATE NOT NULL UNIQUE PRIMARY KEY,
  temperature_min REAL,
  temperature_max REAL,
  weather_icon TEXT,
  weather_description TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 보안 정책 (개인용이므로 전체 허용)
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON calendar_events FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON expense_categories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON expenses FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON memos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON supplements FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON weather_cache FOR ALL TO anon USING (true) WITH CHECK (true);

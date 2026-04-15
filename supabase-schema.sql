
-- =============================================
-- source: supabase-setup.sql
-- =============================================
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

-- =============================================
-- source: supabase-sort-order.sql
-- =============================================
-- 일정 순서 관리: Supabase SQL Editor에서 실행
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- =============================================
-- source: supabase-fixed-expenses.sql
-- =============================================
-- 고정비 테이블: Supabase SQL Editor에서 실행하세요
CREATE TABLE fixed_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount INTEGER NOT NULL,
  category_id UUID REFERENCES expense_categories(id),
  description TEXT,
  day_of_month INTEGER DEFAULT 1,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense')),
  payment_method TEXT DEFAULT '계좌이체' CHECK (payment_method IN ('현금', '카드', '계좌이체', '기타')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON fixed_expenses FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================
-- source: supabase-update-tags.sql
-- =============================================
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

-- =============================================
-- source: supabase-travel.sql
-- =============================================
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

-- =============================================
-- source: supabase-travel-month-color.sql
-- =============================================
-- 여행 항목에 시기(월), 색상 컬럼 추가
ALTER TABLE travel_items ADD COLUMN IF NOT EXISTS month INTEGER;
ALTER TABLE travel_items ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

-- =============================================
-- source: supabase-v2-multiuser.sql
-- =============================================
-- v2 멀티유저 + 일정 공유 + 알림
-- Run in Supabase SQL Editor

-- 1. users 테이블
CREATE TABLE IF NOT EXISTS app_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3B82F6',
  emoji TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 모든 데이터 테이블에 user_id 추가 (없으면)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS shared_with UUID[];

ALTER TABLE event_tags ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE memos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE travel_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE travel_tags ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE product_purchases ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE knowledge_folders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;

-- 3. 기존 데이터는 첫 번째 유저('나')에게 할당
UPDATE calendar_events SET user_id = (SELECT id FROM app_users WHERE name = '나') WHERE user_id IS NULL;
UPDATE expenses SET user_id = (SELECT id FROM app_users WHERE name = '나') WHERE user_id IS NULL;
UPDATE fixed_expenses SET user_id = (SELECT id FROM app_users WHERE name = '나') WHERE user_id IS NULL;
UPDATE memos SET user_id = (SELECT id FROM app_users WHERE name = '나') WHERE user_id IS NULL;
UPDATE travel_items SET user_id = (SELECT id FROM app_users WHERE name = '나') WHERE user_id IS NULL;
UPDATE travel_tags SET user_id = (SELECT id FROM app_users WHERE name = '나') WHERE user_id IS NULL;
UPDATE event_tags SET user_id = (SELECT id FROM app_users WHERE name = '나') WHERE user_id IS NULL;
UPDATE products SET user_id = (SELECT id FROM app_users WHERE name = '나') WHERE user_id IS NULL;
UPDATE product_purchases SET user_id = (SELECT id FROM app_users WHERE name = '나') WHERE user_id IS NULL;

-- 4. 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read, created_at DESC);

-- 5. RLS
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON app_users;
CREATE POLICY "Allow all" ON app_users FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all" ON notifications;
CREATE POLICY "Allow all" ON notifications FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================
-- source: supabase-v2-auth.sql
-- =============================================
-- 사용자 인증 (비밀번호)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_salt TEXT;

-- =============================================
-- source: supabase-v2-avatar.sql
-- =============================================
-- Avatar URL 컬럼 추가
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 기존 기본 유저 "나", "상대" 제거 (원하는 경우)
DELETE FROM app_users WHERE name IN ('나', '상대');

-- =============================================
-- source: supabase-v2-sharing.sql
-- =============================================
-- 일정 공유 수락 플로우
-- shared_with = 공유 대상(대기/수락 전체)
-- shared_accepted_by = 수락한 대상만
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS shared_accepted_by UUID[];

-- 기존 데이터: shared_with의 모두를 수락 처리하지 않음 (새로 공유 시작)

CREATE INDEX IF NOT EXISTS idx_calendar_events_shared_accepted
  ON calendar_events USING GIN (shared_accepted_by);

-- =============================================
-- source: supabase-v2-calendar-shares.sql
-- =============================================
-- 캘린더 전체 공유 테이블
CREATE TABLE IF NOT EXISTS calendar_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_shares_viewer ON calendar_shares(viewer_id, status);
CREATE INDEX IF NOT EXISTS idx_calendar_shares_owner ON calendar_shares(owner_id, status);

ALTER TABLE calendar_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON calendar_shares;
CREATE POLICY "Allow all" ON calendar_shares FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================
-- source: supabase-v2-products.sql
-- =============================================
-- v2 Phase A: Products (생필품) + Purchase History + Fixed Expense 연동
-- Run this in Supabase SQL Editor

-- 1. products 테이블 (기존 supplements의 확장판)
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '기타',
  sub_category TEXT,
  brand TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  monthly_cost INTEGER,
  monthly_consumption REAL DEFAULT 1,
  default_payment_day INTEGER DEFAULT 11,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category, sub_category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- 2. product_purchases (구매 이력/가격 추적)
CREATE TABLE IF NOT EXISTS product_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  total_price INTEGER NOT NULL,
  points INTEGER DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 1,
  quantity_unit TEXT DEFAULT '개',
  purchased_at DATE NOT NULL DEFAULT CURRENT_DATE,
  store TEXT,
  link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_purchases_product_date ON product_purchases(product_id, purchased_at DESC);

-- 3. 기존 supplements → products 마이그레이션 (이미 있으면 스킵)
INSERT INTO products (id, name, category, sub_category, notes, link, created_at, updated_at)
SELECT
  id,
  name,
  CASE WHEN type IS NULL OR type = '' THEN '영양제' ELSE '영양제' END,
  type,
  notes,
  link,
  created_at,
  updated_at
FROM supplements
ON CONFLICT (id) DO NOTHING;

-- 4. fixed_expenses에 product_id 컬럼 추가 (생필품 → 고정비 연동용)
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS main_category TEXT;
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS sub_category TEXT;

-- 5. RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON products;
CREATE POLICY "Allow all" ON products FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON product_purchases;
CREATE POLICY "Allow all" ON product_purchases FOR ALL TO anon USING (true) WITH CHECK (true);

-- 6. monthly_income (월급) 저장용 간단한 settings 테이블 (없으면 생성)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON app_settings;
CREATE POLICY "Allow all" ON app_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- 기본 월급 2,500,000원
INSERT INTO app_settings (key, value) VALUES ('monthly_income', '2500000') ON CONFLICT (key) DO NOTHING;

-- =============================================
-- source: supabase-v2-travel-ext.sql
-- =============================================
-- v2 Phase B: Travel date extensions
ALTER TABLE travel_items
  ADD COLUMN IF NOT EXISTS mood TEXT,
  ADD COLUMN IF NOT EXISTS price_tier INTEGER,
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS couple_notes TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- =============================================
-- source: supabase-v2-knowledge.sql
-- =============================================
-- v2 Phase C: Knowledge base
CREATE TABLE IF NOT EXISTS knowledge_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  parent_id UUID REFERENCES knowledge_folders(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_folders_parent ON knowledge_folders(parent_id, sort_order);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID REFERENCES knowledge_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  tags TEXT[],
  pinned BOOLEAN DEFAULT FALSE,
  type TEXT DEFAULT 'note' CHECK (type IN ('note','link','snippet','recipe')),
  url TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_folder ON knowledge_items(folder_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_tags ON knowledge_items USING GIN (tags);

ALTER TABLE knowledge_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON knowledge_folders;
CREATE POLICY "Allow all" ON knowledge_folders FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all" ON knowledge_items;
CREATE POLICY "Allow all" ON knowledge_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================
-- source: 2026-04-15 login_id column
-- ============================================
-- 로그인 ID (영문/숫자) — 이 컬럼이 없어도 앱은 name으로 폴백 동작.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS login_id TEXT UNIQUE;

-- ============================================
-- source: 2026-04-15 password recovery
-- ============================================
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS recovery_question TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS recovery_answer_hash TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS recovery_answer_salt TEXT;

-- ============================================
-- source: 2026-04-15 Supabase Auth migration (PR1 / step 1-2)
-- ============================================
-- 기존 app_users 프로필을 auth.users와 1:1로 연결하는 브릿지 컬럼.
-- 이전 기간 동안은 NULL 허용. 1-5 단계에서 사용자가 이메일로 로그인하면
-- 자동으로 기존 프로필에 auth_user_id가 연결됨.
-- 1-7 단계에서 login_id/password_hash 경로 제거 후 NOT NULL로 승격 예정.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_users_auth_user_id_idx
  ON app_users(auth_user_id);

-- ============================================
-- source: 2026-04-15 calendar_events.series_id (반복 일정 시리즈 관리)
-- ============================================
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS series_id UUID;
CREATE INDEX IF NOT EXISTS calendar_events_series_id_idx ON calendar_events(series_id);

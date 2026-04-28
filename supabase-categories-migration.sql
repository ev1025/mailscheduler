-- =============================================================
-- 카테고리/태그 — localStorage → Supabase 마이그레이션
-- =============================================================
--
-- 이전 구조: payment_methods / product_categories / travel_categories 는
--   localStorage 에만 저장 (디바이스별로 분리, 동기화 안 됨).
-- 신규 구조: 3개 테이블 + user_id 기반 RLS — 디바이스 간 동기화 + 다중유저 분리.
--
-- Supabase SQL Editor 에서 한 번 실행. 이후 클라이언트 hook 들이 이 테이블을 사용.
-- =============================================================

-- ── 1) payment_methods (결제수단) ────────────────────────────
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id, sort_order);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own rows" ON payment_methods;
CREATE POLICY "Own rows" ON payment_methods FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

-- 시드 — 모든 기존 사용자에게 5개 기본값 INSERT (이미 있는 (user_id, name) 조합은 건너뜀)
INSERT INTO payment_methods (user_id, name, color, sort_order)
SELECT u.id, v.name, v.color, v.sort_order
FROM app_users u
CROSS JOIN (VALUES
  ('카드',     '#3B82F6', 0),
  ('현금',     '#22C55E', 1),
  ('계좌이체', '#A855F7', 2),
  ('자동이체', '#F59E0B', 3),
  ('간편결제', '#E4D547', 4)
) AS v(name, color, sort_order)
ON CONFLICT (user_id, name) DO NOTHING;


-- ── 2) product_categories (생필품 분류) ───────────────────────
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  is_builtin BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_product_categories_user ON product_categories(user_id, sort_order);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own rows" ON product_categories;
CREATE POLICY "Own rows" ON product_categories FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

INSERT INTO product_categories (user_id, name, color, is_builtin, sort_order)
SELECT u.id, v.name, v.color, TRUE, v.sort_order
FROM app_users u
CROSS JOIN (VALUES
  ('영양제', '#22C55E', 0),
  ('화장품', '#EC4899', 1),
  ('단백질', '#F59E0B', 2),
  ('음식',   '#EF4444', 3),
  ('생필품', '#3B82F6', 4),
  ('구독',   '#8B5CF6', 5)
) AS v(name, color, sort_order)
ON CONFLICT (user_id, name) DO NOTHING;


-- ── 3) travel_categories (여행 분류) ─────────────────────────
CREATE TABLE IF NOT EXISTS travel_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  is_builtin BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_travel_categories_user ON travel_categories(user_id, sort_order);

ALTER TABLE travel_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own rows" ON travel_categories;
CREATE POLICY "Own rows" ON travel_categories FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

INSERT INTO travel_categories (user_id, name, color, is_builtin, sort_order)
SELECT u.id, v.name, v.color, TRUE, v.sort_order
FROM app_users u
CROSS JOIN (VALUES
  ('자연',   '#22C55E', 0),
  ('숙소',   '#A855F7', 1),
  ('식당',   '#F50B0B', 2),
  ('놀거리', '#3B82F6', 3),
  ('데이트', '#EC4899', 4),
  ('공연',   '#E1D04E', 5),
  ('쇼핑',   '#06B6D4', 6)
) AS v(name, color, sort_order)
ON CONFLICT (user_id, name) DO NOTHING;


-- ── 4) travel_items.category CHECK 제약 제거 (이전 마이그레이션 안 한 환경 대비) ──
ALTER TABLE travel_items DROP CONSTRAINT IF EXISTS travel_items_category_check;

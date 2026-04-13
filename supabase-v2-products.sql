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

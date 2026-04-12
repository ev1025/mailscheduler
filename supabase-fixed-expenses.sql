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

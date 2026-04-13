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

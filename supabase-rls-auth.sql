-- ============================================
-- PR1 step 1-6: Auth.uid() 기반 RLS 재작성
-- ============================================
-- 이 파일을 Supabase SQL Editor에 한 번 붙여넣고 Run.
-- 기존 "Allow all" anon 정책을 모두 덮어씀.
-- 재실행 안전 (DROP IF EXISTS + CREATE).

-- ────────────────────────────────
-- 0. 헬퍼 함수: 현재 auth 사용자 → app_users.id
-- ────────────────────────────────
CREATE OR REPLACE FUNCTION auth_app_user_id() RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM app_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- ────────────────────────────────
-- 1. app_users — 모두 읽기 가능(공유 대상 목록), 본인만 쓰기/수정/삭제
-- ────────────────────────────────
DROP POLICY IF EXISTS "Allow all" ON app_users;
DROP POLICY IF EXISTS "Read all profiles" ON app_users;
DROP POLICY IF EXISTS "Insert own profile" ON app_users;
DROP POLICY IF EXISTS "Update own profile" ON app_users;
DROP POLICY IF EXISTS "Delete own profile" ON app_users;

CREATE POLICY "Read all profiles" ON app_users
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own profile" ON app_users
  FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Update own profile" ON app_users
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Delete own profile" ON app_users
  FOR DELETE TO authenticated USING (auth_user_id = auth.uid());

-- ────────────────────────────────
-- 2. calendar_events — 본인 + 수락된 공유 읽기, 본인만 쓰기
-- ────────────────────────────────
DROP POLICY IF EXISTS "Allow all" ON calendar_events;
DROP POLICY IF EXISTS "Read own or shared" ON calendar_events;
DROP POLICY IF EXISTS "Insert own events" ON calendar_events;
DROP POLICY IF EXISTS "Update own events" ON calendar_events;
DROP POLICY IF EXISTS "Delete own events" ON calendar_events;

CREATE POLICY "Read own or shared" ON calendar_events
  FOR SELECT TO authenticated USING (
    user_id = auth_app_user_id()
    OR user_id IN (
      SELECT owner_id FROM calendar_shares
      WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
    )
  );
CREATE POLICY "Insert own events" ON calendar_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth_app_user_id());
CREATE POLICY "Update own events" ON calendar_events
  FOR UPDATE TO authenticated USING (user_id = auth_app_user_id());
CREATE POLICY "Delete own events" ON calendar_events
  FOR DELETE TO authenticated USING (user_id = auth_app_user_id());

-- ────────────────────────────────
-- 3. calendar_shares — 본인(owner 또는 viewer) 것만
-- ────────────────────────────────
DROP POLICY IF EXISTS "Allow all" ON calendar_shares;
DROP POLICY IF EXISTS "Own shares" ON calendar_shares;

CREATE POLICY "Own shares" ON calendar_shares
  FOR ALL TO authenticated
  USING (owner_id = auth_app_user_id() OR viewer_id = auth_app_user_id())
  WITH CHECK (owner_id = auth_app_user_id() OR viewer_id = auth_app_user_id());

-- ────────────────────────────────
-- 4. 단순 개인 데이터 테이블 (user_id = 본인)
-- ────────────────────────────────
-- event_tags
DROP POLICY IF EXISTS "Allow all" ON event_tags;
DROP POLICY IF EXISTS "Own rows" ON event_tags;
CREATE POLICY "Own rows" ON event_tags FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

-- expenses
DROP POLICY IF EXISTS "Allow all" ON expenses;
DROP POLICY IF EXISTS "Own rows" ON expenses;
CREATE POLICY "Own rows" ON expenses FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

-- fixed_expenses
DROP POLICY IF EXISTS "Allow all" ON fixed_expenses;
DROP POLICY IF EXISTS "Own rows" ON fixed_expenses;
CREATE POLICY "Own rows" ON fixed_expenses FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

-- memos
DROP POLICY IF EXISTS "Allow all" ON memos;
DROP POLICY IF EXISTS "Own rows" ON memos;
CREATE POLICY "Own rows" ON memos FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

-- travel_items
DROP POLICY IF EXISTS "Allow all" ON travel_items;
DROP POLICY IF EXISTS "Own rows" ON travel_items;
CREATE POLICY "Own rows" ON travel_items FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

-- travel_tags
DROP POLICY IF EXISTS "Allow all" ON travel_tags;
DROP POLICY IF EXISTS "Own rows" ON travel_tags;
CREATE POLICY "Own rows" ON travel_tags FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

-- products
DROP POLICY IF EXISTS "Allow all" ON products;
DROP POLICY IF EXISTS "Own rows" ON products;
CREATE POLICY "Own rows" ON products FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

-- product_purchases
DROP POLICY IF EXISTS "Allow all" ON product_purchases;
DROP POLICY IF EXISTS "Own rows" ON product_purchases;
CREATE POLICY "Own rows" ON product_purchases FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

-- knowledge_folders
DROP POLICY IF EXISTS "Allow all" ON knowledge_folders;
DROP POLICY IF EXISTS "Own rows" ON knowledge_folders;
CREATE POLICY "Own rows" ON knowledge_folders FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

-- knowledge_items
DROP POLICY IF EXISTS "Allow all" ON knowledge_items;
DROP POLICY IF EXISTS "Own rows" ON knowledge_items;
CREATE POLICY "Own rows" ON knowledge_items FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

-- notifications
DROP POLICY IF EXISTS "Allow all" ON notifications;
DROP POLICY IF EXISTS "Own rows" ON notifications;
CREATE POLICY "Own rows" ON notifications FOR ALL TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

-- ────────────────────────────────
-- 5. 공용/전역 테이블 (로그인한 사용자면 모두 읽기/쓰기)
-- ────────────────────────────────
-- expense_categories: 기본 시드 + 사용자 추가분 공유 (향후 per-user로 리팩토 예정)
DROP POLICY IF EXISTS "Allow all" ON expense_categories;
DROP POLICY IF EXISTS "Authenticated" ON expense_categories;
CREATE POLICY "Authenticated" ON expense_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- app_settings: monthly_income 등 (향후 per-user로 리팩토 예정)
DROP POLICY IF EXISTS "Allow all" ON app_settings;
DROP POLICY IF EXISTS "Authenticated" ON app_settings;
CREATE POLICY "Authenticated" ON app_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- supplements: legacy 테이블
DROP POLICY IF EXISTS "Allow all" ON supplements;
DROP POLICY IF EXISTS "Authenticated" ON supplements;
CREATE POLICY "Authenticated" ON supplements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ────────────────────────────────
-- 6. 특수: weather_cache — 서버 라우트(/api/weather)가 anon으로 접근
-- 공용 캐시라 로그인 없이도 읽고 쓸 수 있게 유지 (민감 정보 아님)
-- ────────────────────────────────
DROP POLICY IF EXISTS "Allow all" ON weather_cache;
CREATE POLICY "Public cache" ON weather_cache
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

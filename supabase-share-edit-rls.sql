-- ============================================
-- 공유 상대(calendar_shares.status='accepted') 에게
-- 여행 항목·계획·일정 테이블의 편집 권한 부여.
-- Supabase SQL Editor 에 붙여넣고 Run. 재실행 안전.
-- ============================================

-- travel_items: owner + accepted viewer 모두 R/W (기존 "Own rows" 대체)
DROP POLICY IF EXISTS "Own rows" ON travel_items;
DROP POLICY IF EXISTS "Own or shared" ON travel_items;
CREATE POLICY "Own or shared" ON travel_items
  FOR ALL TO authenticated
  USING (
    user_id = auth_app_user_id()
    OR user_id IN (
      SELECT owner_id FROM calendar_shares
      WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
    )
  )
  WITH CHECK (
    user_id = auth_app_user_id()
    OR user_id IN (
      SELECT owner_id FROM calendar_shares
      WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
    )
  );

-- travel_plans: owner + accepted viewer 모두 R/W
DROP POLICY IF EXISTS "Allow all" ON travel_plans;
DROP POLICY IF EXISTS "Own or shared" ON travel_plans;
CREATE POLICY "Own or shared" ON travel_plans
  FOR ALL TO authenticated
  USING (
    user_id = auth_app_user_id()
    OR user_id IN (
      SELECT owner_id FROM calendar_shares
      WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
    )
  )
  WITH CHECK (
    user_id = auth_app_user_id()
    OR user_id IN (
      SELECT owner_id FROM calendar_shares
      WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
    )
  );

-- travel_plan_tasks: 해당 plan 의 권한을 따라감 (plan_id 경유 subquery)
DROP POLICY IF EXISTS "Allow all" ON travel_plan_tasks;
DROP POLICY IF EXISTS "Via plan" ON travel_plan_tasks;
CREATE POLICY "Via plan" ON travel_plan_tasks
  FOR ALL TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM travel_plans
      WHERE user_id = auth_app_user_id()
         OR user_id IN (
           SELECT owner_id FROM calendar_shares
           WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
         )
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT id FROM travel_plans
      WHERE user_id = auth_app_user_id()
         OR user_id IN (
           SELECT owner_id FROM calendar_shares
           WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
         )
    )
  );

-- travel_tags: 공유자도 태그 풀 읽기 가능 (쓰기는 소유자만 → 구분)
DROP POLICY IF EXISTS "Own rows" ON travel_tags;
DROP POLICY IF EXISTS "Read own or shared" ON travel_tags;
DROP POLICY IF EXISTS "Write own" ON travel_tags;
CREATE POLICY "Read own or shared" ON travel_tags
  FOR SELECT TO authenticated USING (
    user_id = auth_app_user_id()
    OR user_id IN (
      SELECT owner_id FROM calendar_shares
      WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
    )
  );
CREATE POLICY "Write own" ON travel_tags
  FOR INSERT TO authenticated WITH CHECK (user_id = auth_app_user_id());
CREATE POLICY "Update own" ON travel_tags
  FOR UPDATE TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());
CREATE POLICY "Delete own" ON travel_tags
  FOR DELETE TO authenticated USING (user_id = auth_app_user_id());

-- calendar_events: 공유자도 수정/삭제 가능하도록 확장
DROP POLICY IF EXISTS "Insert own events" ON calendar_events;
DROP POLICY IF EXISTS "Update own events" ON calendar_events;
DROP POLICY IF EXISTS "Delete own events" ON calendar_events;
DROP POLICY IF EXISTS "Write shared events" ON calendar_events;
DROP POLICY IF EXISTS "Update shared events" ON calendar_events;
DROP POLICY IF EXISTS "Delete shared events" ON calendar_events;
CREATE POLICY "Write shared events" ON calendar_events
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth_app_user_id()
    OR user_id IN (
      SELECT owner_id FROM calendar_shares
      WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
    )
  );
CREATE POLICY "Update shared events" ON calendar_events
  FOR UPDATE TO authenticated USING (
    user_id = auth_app_user_id()
    OR user_id IN (
      SELECT owner_id FROM calendar_shares
      WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
    )
  );
CREATE POLICY "Delete shared events" ON calendar_events
  FOR DELETE TO authenticated USING (
    user_id = auth_app_user_id()
    OR user_id IN (
      SELECT owner_id FROM calendar_shares
      WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
    )
  );

-- =============================================================
-- 공유 권한 양방향화 — 한쪽이 신청·수락하면 양쪽 모두 R/W (맞팔로우 모델)
-- =============================================================
--
-- 이전: calendar_shares 행 (owner=A, viewer=B, accepted) 하나는 한 방향 권한.
--       B → A 데이터 접근 OK, A → B 데이터 접근 X.
-- 지금: 행이 어느 방향이든 양쪽이 서로의 데이터에 R/W 권한.
--
-- 구현: 헬퍼 함수 shared_user_ids() 가 양 방향(내가 viewer 인 owner + 내가
--       owner 인 viewer)을 UNION 으로 반환. 모든 정책에서 이 함수만 호출.
--       기존 데이터 손대지 않음 — 정책만 갱신.
--
-- 영향 테이블: calendar_events, event_tags, travel_items, travel_tags,
--             travel_plans, travel_plan_tasks
--
-- ⚠️ 일정 공유의 의미가 "단방향 보기"에서 "맞팔 R/W"로 바뀜. 한쪽만 신청해도
--    수락 시 양쪽이 서로의 캘린더·여행을 수정 가능. 이 의도 맞는지 재확인.
-- =============================================================

-- ────────────────────────────────
-- 0. 헬퍼 함수 — 나와 공유 관계인 사용자 id 들 (양방향)
-- ────────────────────────────────
CREATE OR REPLACE FUNCTION shared_user_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id FROM calendar_shares
  WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
  UNION
  SELECT viewer_id FROM calendar_shares
  WHERE owner_id = auth_app_user_id() AND status = 'accepted'
$$;

-- ────────────────────────────────
-- 1. calendar_events — Read/Write/Update/Delete 모두 양방향
-- ────────────────────────────────
DROP POLICY IF EXISTS "Read own or shared" ON calendar_events;
DROP POLICY IF EXISTS "Write shared events" ON calendar_events;
DROP POLICY IF EXISTS "Update shared events" ON calendar_events;
DROP POLICY IF EXISTS "Delete shared events" ON calendar_events;
DROP POLICY IF EXISTS "Insert own events" ON calendar_events;
DROP POLICY IF EXISTS "Update own events" ON calendar_events;
DROP POLICY IF EXISTS "Delete own events" ON calendar_events;

CREATE POLICY "Read own or shared" ON calendar_events
  FOR SELECT TO authenticated USING (
    user_id = auth_app_user_id() OR user_id IN (SELECT shared_user_ids())
  );
CREATE POLICY "Write shared events" ON calendar_events
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth_app_user_id() OR user_id IN (SELECT shared_user_ids())
  );
CREATE POLICY "Update shared events" ON calendar_events
  FOR UPDATE TO authenticated USING (
    user_id = auth_app_user_id() OR user_id IN (SELECT shared_user_ids())
  );
CREATE POLICY "Delete shared events" ON calendar_events
  FOR DELETE TO authenticated USING (
    user_id = auth_app_user_id() OR user_id IN (SELECT shared_user_ids())
  );

-- ────────────────────────────────
-- 2. event_tags — Read 양방향, Write/Update/Delete 는 본인만 유지
--    (태그 풀은 공유하되 추가·삭제는 각자 관리 — 충돌 방지)
-- ────────────────────────────────
DROP POLICY IF EXISTS "Read own or shared" ON event_tags;
CREATE POLICY "Read own or shared" ON event_tags
  FOR SELECT TO authenticated USING (
    user_id = auth_app_user_id() OR user_id IN (SELECT shared_user_ids())
  );

-- ────────────────────────────────
-- 3. travel_items — Read/Write/Update/Delete 모두 양방향
-- ────────────────────────────────
DROP POLICY IF EXISTS "Own or shared" ON travel_items;
CREATE POLICY "Own or shared" ON travel_items
  FOR ALL TO authenticated
  USING (
    user_id = auth_app_user_id() OR user_id IN (SELECT shared_user_ids())
  )
  WITH CHECK (
    user_id = auth_app_user_id() OR user_id IN (SELECT shared_user_ids())
  );

-- ────────────────────────────────
-- 4. travel_tags — Read 양방향, Write/Update/Delete 는 본인만 유지
-- ────────────────────────────────
DROP POLICY IF EXISTS "Read own or shared" ON travel_tags;
CREATE POLICY "Read own or shared" ON travel_tags
  FOR SELECT TO authenticated USING (
    user_id = auth_app_user_id() OR user_id IN (SELECT shared_user_ids())
  );

-- ────────────────────────────────
-- 5. travel_plans — Read/Write/Update/Delete 모두 양방향
-- ────────────────────────────────
DROP POLICY IF EXISTS "Own or shared" ON travel_plans;
CREATE POLICY "Own or shared" ON travel_plans
  FOR ALL TO authenticated
  USING (
    user_id = auth_app_user_id() OR user_id IN (SELECT shared_user_ids())
  )
  WITH CHECK (
    user_id = auth_app_user_id() OR user_id IN (SELECT shared_user_ids())
  );

-- ────────────────────────────────
-- 6. travel_plan_tasks — 해당 plan 의 권한 따라감
-- ────────────────────────────────
DROP POLICY IF EXISTS "Via plan" ON travel_plan_tasks;
CREATE POLICY "Via plan" ON travel_plan_tasks
  FOR ALL TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM travel_plans
      WHERE user_id = auth_app_user_id()
         OR user_id IN (SELECT shared_user_ids())
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT id FROM travel_plans
      WHERE user_id = auth_app_user_id()
         OR user_id IN (SELECT shared_user_ids())
    )
  );

-- ────────────────────────────────
-- 확인용
-- ────────────────────────────────
-- 함수 정상 동작 확인:
--   SELECT * FROM shared_user_ids();
-- 정책 적용 확인:
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('calendar_events','event_tags','travel_items',
--                       'travel_tags','travel_plans','travel_plan_tasks')
--   ORDER BY tablename, cmd;

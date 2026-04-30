-- =============================================================
-- event_tags: 공유받은 사용자도 읽을 수 있도록 RLS 확장
-- =============================================================
--
-- 문제: 일정 공유 상대가 달력·여행 화면에서 owner 의 태그를 못 읽어 색이 모두
--       회색(fallback)으로 보임. 이유는 event_tags 정책이 "Own rows" (본인만)
--       이라 owner 의 행을 SELECT 단계에서 차단했기 때문.
--
-- 해법: travel_tags 와 동일하게 "Read own or shared" 정책 추가. 쓰기는 본인만.
-- =============================================================

DROP POLICY IF EXISTS "Own rows" ON event_tags;
DROP POLICY IF EXISTS "Read own or shared" ON event_tags;
DROP POLICY IF EXISTS "Write own" ON event_tags;
DROP POLICY IF EXISTS "Update own" ON event_tags;
DROP POLICY IF EXISTS "Delete own" ON event_tags;

CREATE POLICY "Read own or shared" ON event_tags
  FOR SELECT TO authenticated USING (
    user_id = auth_app_user_id()
    OR user_id IN (
      SELECT owner_id FROM calendar_shares
      WHERE viewer_id = auth_app_user_id() AND status = 'accepted'
    )
  );

CREATE POLICY "Write own" ON event_tags
  FOR INSERT TO authenticated WITH CHECK (user_id = auth_app_user_id());

CREATE POLICY "Update own" ON event_tags
  FOR UPDATE TO authenticated
  USING (user_id = auth_app_user_id())
  WITH CHECK (user_id = auth_app_user_id());

CREATE POLICY "Delete own" ON event_tags
  FOR DELETE TO authenticated USING (user_id = auth_app_user_id());

-- 확인:
-- SELECT * FROM pg_policies WHERE tablename = 'event_tags';

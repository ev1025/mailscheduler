-- ============================================
-- PR2: Supabase Storage 버킷 + RLS 정책
-- ============================================
-- 이 파일 실행 전에 반드시 대시보드에서 버킷을 먼저 만들어주세요:
--   1) https://supabase.com/dashboard 접속
--   2) 프로젝트 선택 > 왼쪽 메뉴 "Storage"
--   3) "New bucket" 클릭
--   4) 아래 2개 버킷 각각 생성:
--      - name: avatars          / Public: ON  / Allowed MIME: image/*  / File size limit: 5 MB
--      - name: knowledge-images / Public: ON  / Allowed MIME: image/*  / File size limit: 10 MB
--   5) 생성 후 이 SQL을 SQL Editor에 붙여넣고 Run
--
-- 버킷을 public으로 만드는 이유: <img src="..."> 렌더링 시 인증 없이 로드 가능.
-- 업로드는 본인 auth.uid() 경로로만 가능하도록 아래 정책이 제한.

-- ────────────────────────────────
-- avatars 버킷 정책
-- ────────────────────────────────
DROP POLICY IF EXISTS "Avatars read public" ON storage.objects;
DROP POLICY IF EXISTS "Avatars insert own" ON storage.objects;
DROP POLICY IF EXISTS "Avatars update own" ON storage.objects;
DROP POLICY IF EXISTS "Avatars delete own" ON storage.objects;

CREATE POLICY "Avatars read public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');

CREATE POLICY "Avatars insert own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Avatars update own" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Avatars delete own" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ────────────────────────────────
-- knowledge-images 버킷 정책
-- ────────────────────────────────
DROP POLICY IF EXISTS "Knowledge images read public" ON storage.objects;
DROP POLICY IF EXISTS "Knowledge images insert own" ON storage.objects;
DROP POLICY IF EXISTS "Knowledge images update own" ON storage.objects;
DROP POLICY IF EXISTS "Knowledge images delete own" ON storage.objects;

CREATE POLICY "Knowledge images read public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'knowledge-images');

CREATE POLICY "Knowledge images insert own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'knowledge-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Knowledge images update own" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'knowledge-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Knowledge images delete own" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'knowledge-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

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

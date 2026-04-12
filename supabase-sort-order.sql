-- 일정 순서 관리: Supabase SQL Editor에서 실행
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

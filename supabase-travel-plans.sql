-- 여행 계획 (신규) — travel_plans + travel_plan_tasks
-- Supabase SQL Editor 에서 한 번 실행.

CREATE TABLE IF NOT EXISTS travel_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_plan_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES travel_plans(id) ON DELETE CASCADE,
  day_index INT DEFAULT 0,              -- 0,1,2... "일자별" 필터
  start_time TIME,                      -- 선택
  place_name TEXT NOT NULL,
  place_address TEXT,
  place_lat DOUBLE PRECISION,
  place_lng DOUBLE PRECISION,
  tag TEXT,
  content TEXT,
  stay_minutes INT DEFAULT 0,
  manual_order INT DEFAULT 0,
  transport_mode TEXT,                  -- 'car' | 'bus' | 'taxi' | 'train'
  transport_duration_sec INT,
  transport_manual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tpt_plan_day_time
  ON travel_plan_tasks (plan_id, day_index, start_time, manual_order);

ALTER TABLE travel_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_plan_tasks ENABLE ROW LEVEL SECURITY;

-- 개인용 RLS 패턴 (기존 테이블들과 동일)
DROP POLICY IF EXISTS "Allow all" ON travel_plans;
DROP POLICY IF EXISTS "Allow all" ON travel_plan_tasks;
CREATE POLICY "Allow all" ON travel_plans FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON travel_plan_tasks FOR ALL TO anon USING (true) WITH CHECK (true);

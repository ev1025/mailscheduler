-- 일정 공유 수락 플로우
-- shared_with = 공유 대상(대기/수락 전체)
-- shared_accepted_by = 수락한 대상만
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS shared_accepted_by UUID[];

-- 기존 데이터: shared_with의 모두를 수락 처리하지 않음 (새로 공유 시작)

CREATE INDEX IF NOT EXISTS idx_calendar_events_shared_accepted
  ON calendar_events USING GIN (shared_accepted_by);

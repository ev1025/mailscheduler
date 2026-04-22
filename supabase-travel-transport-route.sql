-- travel_plan_tasks 에 transport_route JSONB 컬럼 추가.
-- 이동수단 picker 대중교통 탭에서 선택한 조합 경로(도보+버스+지하철 혼합)의
-- step 배열을 저장. transport_mode='transit' 일 때만 채워짐.
--
-- 배열 각 요소 형식:
-- {
--   "kind": "walk" | "bus" | "subway" | "train" | "tram" | "other",
--   "durationSec": number,
--   "name": string | null,          // "2호선" "472번"
--   "fromStop": string | null,
--   "toStop": string | null,
--   "numStops": number | null,
--   "alternateNames": string[] | null  // 집계된 대안 노선 번호들
-- }

ALTER TABLE travel_plan_tasks
  ADD COLUMN IF NOT EXISTS transport_route JSONB;

-- 여행 계획 leg 수단별 소요시간 캐시.
-- 기존 transport_duration_sec 은 "선택된 수단" 의 값만 저장 → 수단을 바꾸면
-- 이전 값 유실. 비교 뷰에서 4개 수단 동시 표시하려면 모두 캐시해둬야 함.
--
-- JSONB 구조: { "car": 3900, "bus": 7200, "taxi": 3900, "train": 3600 }
-- - 값 null 이면 "호출했지만 결과 없음"
-- - 키 자체 없으면 "아직 호출 안 함"

ALTER TABLE travel_plan_tasks
  ADD COLUMN IF NOT EXISTS transport_durations JSONB DEFAULT '{}'::JSONB;

-- 기존 데이터 — 선택된 수단 값이 있으면 그걸 새 컬럼에도 복사
UPDATE travel_plan_tasks
SET transport_durations = jsonb_build_object(transport_mode, transport_duration_sec)
WHERE transport_mode IS NOT NULL
  AND transport_duration_sec IS NOT NULL
  AND (transport_durations IS NULL OR transport_durations = '{}'::JSONB);

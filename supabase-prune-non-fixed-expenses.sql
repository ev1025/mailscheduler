-- =============================================================
-- 가계부 정리 — 활성 고정비 매칭 거래만 남기고 모두 삭제 (일회성)
-- =============================================================
--
-- 목적: 사용자가 일일이 입력한 거래·중복 자동 등록 등을 청소하고,
-- 현재 활성(is_active=TRUE) 고정비에 매칭되는 거래만 보존.
--
-- 매칭 규칙: (user_id, amount, description) 동일이면 매칭으로 간주.
--  - description 이 양쪽 다 NULL 인 경우도 매칭 (COALESCE '').
--  - 날짜(day_of_month) 는 매칭 조건에 포함하지 않음 — 같은 amount/desc 의
--    과거 모든 자동 등록도 보존하기 위함.
--  - 같은 amount/desc 의 일반 거래도 보존됨 (drawback). 정확 추적은 fk 컬럼 필요.
--
-- ⚠️ 되돌릴 수 없는 작업이므로 실행 전에 백업 권장 (Supabase 대시보드 → DB → Backups).
-- =============================================================

-- 미리보기 — 삭제될 행을 먼저 확인하고 싶으면 아래 SELECT 를 실행:
-- SELECT id, date, amount, description, type
-- FROM expenses e
-- WHERE NOT EXISTS (
--   SELECT 1 FROM fixed_expenses fx
--   WHERE fx.is_active = TRUE
--     AND fx.amount = e.amount
--     AND COALESCE(fx.description, '') = COALESCE(e.description, '')
--     AND fx.user_id = e.user_id
-- )
-- ORDER BY date DESC;

-- 본 삭제:
DELETE FROM expenses e
WHERE NOT EXISTS (
  SELECT 1 FROM fixed_expenses fx
  WHERE fx.is_active = TRUE
    AND fx.amount = e.amount
    AND COALESCE(fx.description, '') = COALESCE(e.description, '')
    AND fx.user_id = e.user_id
);

-- 정리 후 남은 행 수 확인:
-- SELECT COUNT(*) AS remaining FROM expenses;

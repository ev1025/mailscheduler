-- =============================================================
-- 가계부 중복 거래 정리 — 일회성 SQL
-- =============================================================
--
-- 배경: 이전 버전의 자동 고정비 적용 로직이 < / > 화살표 클릭 시 매번 트리거
-- 되어 같은 (user_id, amount, description, date, type) 조합이 여러 행 들어간
-- 케이스 정리.
--
-- 동작: 같은 그룹 내에서 created_at 가장 오래된 1개만 남기고 나머지 삭제.
-- 안전: 같은 날 같은 금액에 같은 description 인 "정상 중복" 도 같이 정리되지만
-- 가계부 실제 사용에선 거의 발생하지 않는 케이스 (의도적이라면 description
-- 이나 시간을 다르게 적었을 것).
--
-- 실행: Supabase SQL Editor 에 한 번 붙여넣고 Run.
-- 재실행해도 안전 (이미 1개만 있으면 변화 없음).
-- =============================================================

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, amount, COALESCE(description, ''), date, type, payment_method
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM expenses
)
DELETE FROM expenses
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 정리 후 남은 행 수 확인용 (참고).
-- SELECT COUNT(*) AS remaining FROM expenses;

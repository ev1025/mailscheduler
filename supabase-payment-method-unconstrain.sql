-- payment_method 컬럼의 CHECK 제약 제거.
-- 사용자가 결제수단을 자유롭게 추가할 수 있는 UX(usePaymentMethods + TagInput)와
-- 충돌해서, "삼성카드" 같이 기본 4개(현금/카드/계좌이체/기타) 외 값을
-- 입력하면 DB 가 거부 → 저장 실패로 폼이 그대로 멈춰 있던 문제.
--
-- 결제수단의 표준 값 관리는 클라이언트(localStorage)에서 담당하고,
-- DB 는 단순 TEXT 로 보관.

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_payment_method_check;

ALTER TABLE fixed_expenses
  DROP CONSTRAINT IF EXISTS fixed_expenses_payment_method_check;

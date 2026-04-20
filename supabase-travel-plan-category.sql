-- 여행 계획 task 에 분류(category) 컬럼 추가.
-- 기존 tag 컬럼은 "태그(복수, 콤마구분)" 본래 용도로 복귀.
-- 분류는 단일 값(자연/숙소/식당/놀거리/데이트/공연/쇼핑/기타/커스텀).

ALTER TABLE travel_plan_tasks
  ADD COLUMN IF NOT EXISTS category TEXT;

-- 최근 짧은 기간에 tag 컬럼에 분류 단일값을 넣어둔 케이스가 있다면, 그 값들은
-- 사용자가 직접 재설정. (자동 마이그레이션은 하지 않음 — 실제 태그일 수도 있음)

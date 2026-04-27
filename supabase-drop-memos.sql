-- 메모 페이지 기능 제거에 따른 memos 테이블 삭제.
-- /memo 페이지는 사용되지 않아 제거됐고, 다른 페이지의 "메모" 라벨은
-- expenses.description / calendar_events.description / products.notes /
-- travel_items.notes 등으로 별개. memos 테이블 자체는 더 이상 참조되지 않음.

-- CASCADE 로 RLS 정책·인덱스 함께 제거.
DROP TABLE IF EXISTS memos CASCADE;

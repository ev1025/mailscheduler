-- =============================================================
-- 기본 카테고리 테이블 인벤토리 + 기본값 수정 SQL
-- =============================================================
--
-- 이 앱에 "기본 카테고리"가 들어 있는 곳은 두 종류로 나뉩니다.
--
-- [A] Supabase DB 테이블 — 서버 저장. 모든 사용자/디바이스 공유.
--     아래 SQL 로 직접 수정 가능.
--
-- [B] 코드 상수 + localStorage — 클라이언트 디바이스별 저장.
--     소스 파일을 직접 수정해야 기본값 변경 가능.
--     기존 사용자의 localStorage 는 영향 받지 않음(이미 저장된 커스텀이 우선).
--
-- =============================================================

-- =============================================================
-- [A-1] expense_categories — 가계부 수입/지출 카테고리
-- =============================================================
-- 컬럼: id, name, icon (lucide), color (hex), type ('income'|'expense')
-- 시드:
--   수입(4): 급여, 부수입, 용돈, 기타수입
--   지출(10): 식비, 교통비, 쇼핑, 주거비, 통신비, 의료비, 문화생활, 카페/간식, 구독료, 기타지출
--
-- 현재 데이터 보기:
--   SELECT name, icon, color, type FROM expense_categories ORDER BY type, name;
--
-- 이름 변경 (예: '카페/간식' → '간식'):
UPDATE expense_categories SET name = '간식' WHERE name = '카페/간식';

-- 색 변경 (예: 식비 색을 살짝 어둡게):
UPDATE expense_categories SET color = '#DC2626' WHERE name = '식비';

-- 새 카테고리 추가:
-- INSERT INTO expense_categories (name, icon, color, type) VALUES
--   ('경조사', 'gift', '#A78BFA', 'expense');

-- 기본 카테고리 삭제 — ⚠️ 해당 카테고리를 사용 중인 거래가 있으면 FK 오류.
-- 먼저 대체 카테고리로 옮기거나 거래 삭제 필요:
--   UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = '기타지출')
--     WHERE category_id = (SELECT id FROM expense_categories WHERE name = '카페/간식');
--   DELETE FROM expense_categories WHERE name = '카페/간식';


-- =============================================================
-- [A-2] event_tags — 캘린더 일정 태그
-- =============================================================
-- 컬럼: id, name (UNIQUE), color
-- 시드(6): 데이트, 약속, 회사, 개인, 운동, 여행
--
-- 현재 데이터:
--   SELECT name, color FROM event_tags ORDER BY name;

-- 이름 변경:
UPDATE event_tags SET name = '미팅' WHERE name = '회사';

-- 색 변경:
UPDATE event_tags SET color = '#F87171' WHERE name = '약속';

-- 새 태그 추가:
-- INSERT INTO event_tags (name, color) VALUES ('가족', '#FB923C');

-- 삭제 (calendar_events.tag 는 TEXT 라 FK 없음 — 기존 일정의 태그 텍스트만 남음):
-- DELETE FROM event_tags WHERE name = '회사';


-- =============================================================
-- [A-3] travel_tags — 여행 항목 태그
-- =============================================================
-- 컬럼: id, name (UNIQUE), color
-- 시드(6): 벚꽃, 불꽃놀이, 드론, 단풍, 야경, 한정메뉴
--
-- 현재 데이터:
--   SELECT name, color FROM travel_tags ORDER BY name;

-- 변경 예시:
UPDATE travel_tags SET color = '#FCA5A5' WHERE name = '불꽃놀이';
-- INSERT INTO travel_tags (name, color) VALUES ('맛집', '#F59E0B');
-- DELETE FROM travel_tags WHERE name = '드론';


-- =============================================================
-- [B] 클라이언트 코드 상수 (참고만 — SQL 적용 안 됨)
-- =============================================================
--
-- 아래는 소스 파일에서 직접 수정해야 함:
--
-- 1) 결제수단 — src/hooks/use-payment-methods.ts
--    const DEFAULTS = ["카드", "현금", "계좌이체", "기타"];
--    const SEED_COLORS = ["#3B82F6", "#22C55E", "#A855F7", "#F59E0B"];
--    localStorage 키: payment_methods
--
-- 2) 생필품 분류 — src/hooks/use-product-categories.ts
--    BUILTIN: 영양제 / 화장품 / 단백질 / 음식 / 생필품 / 구독 / 기타
--    localStorage 키: product_mid_categories_custom (사용자 추가만 저장)
--
-- 3) 여행 분류 — src/hooks/use-travel-categories.ts
--    BUILTIN_TRAVEL_CATEGORIES: 자연 / 숙소 / 식당 / 놀거리 / 데이트 / 공연 / 쇼핑 / 기타
--
-- 변경 후 새로 깔리는 디바이스부터 반영. 기존 사용자는 localStorage 초기화 필요시:
--   localStorage.removeItem("payment_methods");
--   localStorage.removeItem("product_mid_categories_custom");
--   localStorage.removeItem("product_mid_categories_colors");

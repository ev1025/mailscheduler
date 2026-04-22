-- 데이트/여행 CSV → travel_items 일괄 등록
-- 카테고리는 모르는 값 → 기타 로 폴백. 중복 방지: (title, user_id) 존재 시 skip.
-- user_id 는 app_users 에서 name='나' 자동 매핑.

-- 구버전 스키마의 CHECK 제약이 남아 있을 수 있어 방어적으로 드롭.
-- ('공연' '데이트' 등 v2 카테고리가 원래 제약에 없으므로)
ALTER TABLE travel_items DROP CONSTRAINT IF EXISTS travel_items_category_check;

-- 단일 INSERT + VALUES 리스트 + WHERE NOT EXISTS 로 일괄 중복제거 등록
WITH uid AS (SELECT id FROM app_users WHERE name = '도도새' LIMIT 1)
INSERT INTO travel_items (title, category, region, month, visited, user_id)
SELECT v.title, v.category, v.region, v.month, v.visited, (SELECT id FROM uid)
FROM (VALUES
  ('강릉여행', '여행', '강릉'::TEXT, NULL::INT, TRUE),
  ('클래식 공연 보기', '공연', NULL::TEXT, NULL::INT, TRUE),
  ('서울식물원 수국', '자연', '마곡나루역 9호선'::TEXT, 5::INT, FALSE),
  ('석촌호수 벚꽃', '자연', '잠실역 2호선'::TEXT, 4::INT, TRUE),
  ('하동매실거리 매화', '자연', '신답역 2호선'::TEXT, 3::INT, TRUE),
  ('초안산 수국동산', '자연', '노원쪽'::TEXT, 6::INT, FALSE),
  ('경의선 숲길 벚꽃', '자연', '홍대입구'::TEXT, 4::INT, FALSE),
  ('클럽에반스 재즈바', '공연', '합정역'::TEXT, NULL::INT, TRUE),
  ('차이나타운 + 월미도', '기타', '인천'::TEXT, NULL::INT, TRUE),
  ('대방어 먹기', '식당', NULL::TEXT, 12::INT, TRUE),
  ('은평 카라반 가기', '숙소', '구파발역쪽'::TEXT, NULL::INT, TRUE),
  ('야구보기', '공연', NULL::TEXT, NULL::INT, FALSE),
  ('김가이가 버섯매운탕, 때가이르메 베리에이드', '식당', '숙대입구'::TEXT, NULL::INT, TRUE),
  ('다로베 피자(예약)', '식당', '서울숲역'::TEXT, NULL::INT, FALSE),
  ('한강 와이키키마켓', '식당', '마포구청역'::TEXT, NULL::INT, TRUE),
  ('평창동 미술관투어(가나아트센터, 시립미술아카이브, 토속칼국수)', '놀거리', '평창동'::TEXT, NULL::INT, FALSE),
  ('노량진 컵밥 투어', '식당', '노량진역'::TEXT, NULL::INT, FALSE),
  ('삼각지 투어(전쟁기념관2층, 맛집)', '놀거리', '삼각지역'::TEXT, NULL::INT, FALSE),
  ('씨너스죄인들', '공연', NULL::TEXT, NULL::INT, TRUE),
  ('잠실 투어', '놀거리', '잠실역'::TEXT, NULL::INT, TRUE),
  ('명동 투어', '놀거리', '명동역'::TEXT, NULL::INT, FALSE),
  ('베어트리파크 장미', '자연', '세종시'::TEXT, 5::INT, FALSE),
  ('소양강댐', '자연', '춘천'::TEXT, 12::INT, TRUE),
  ('하늘공원', '자연', '월드컵경기장'::TEXT, 12::INT, FALSE),
  ('압구정투어', '놀거리', '압구정'::TEXT, NULL::INT, FALSE),
  ('단풍구경', '자연', '서울'::TEXT, 11::INT, FALSE),
  ('원주 은행나무', '자연', '원주시'::TEXT, 11::INT, FALSE),
  ('화랑대 벚꽃', '자연', '화랑대역'::TEXT, 4::INT, TRUE),
  ('원미산 진달래', '자연', '부평'::TEXT, 4::INT, FALSE),
  ('쭈꾸미낚시', '자연', '인천'::TEXT, 10::INT, FALSE),
  ('겹벚꽃 각원사', '자연', '천안시'::TEXT, 4::INT, FALSE),
  ('아트만', '식당', '경복궁'::TEXT, NULL::INT, FALSE),
  ('인왕산 벚꽃', '자연', NULL::TEXT, 4::INT, TRUE),
  ('경마장', '자연', NULL::TEXT, NULL::INT, FALSE),
  ('여주 벚꽃길', '자연', NULL::TEXT, 4::INT, FALSE),
  ('라벤더 신안', '자연', '전남 신안'::TEXT, 5::INT, FALSE),
  ('신안 튤립축제', '자연', '전남 신안 임자도'::TEXT, 4::INT, FALSE)
) AS v(title, category, region, month, visited)
WHERE (SELECT id FROM uid) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM travel_items t
    WHERE t.title = v.title AND t.user_id = (SELECT id FROM uid)
  );

-- 포함: 37 건
--   여행 → 기타: 강릉여행
--   공연 → 공연: 클래식 공연 보기
--   자연 → 자연: 서울식물원 수국
--   자연 → 자연: 석촌호수 벚꽃
--   자연 → 자연: 하동매실거리 매화
--   자연 → 자연: 초안산 수국동산
--   자연 → 자연: 경의선 숲길 벚꽃
--   공연 → 공연: 클럽에반스 재즈바
--   여행 → 기타: 차이나타운 + 월미도
--   식사 → 식당: 대방어 먹기
--   여행 → 기타: 은평 카라반 가기
--   공연 → 공연: 야구보기
--   식사 → 식당: 김가이가 버섯매운탕, 때가이르메 베리에이드
--   식사 → 식당: 다로베 피자(예약)
--   식사 → 식당: 한강 와이키키마켓
--   동네투어 → 놀거리: 평창동 미술관투어(가나아트센터, 시립미술아카이브, 토속칼국수)
--   식사 → 식당: 노량진 컵밥 투어
--   동네투어 → 놀거리: 삼각지 투어(전쟁기념관2층, 맛집)
--   영화 → 공연: 씨너스죄인들
--   동네투어 → 놀거리: 잠실 투어
--   동네투어 → 놀거리: 명동 투어
--   자연 → 자연: 베어트리파크 장미
--   자연 → 자연: 소양강댐
--   자연 → 자연: 하늘공원
--   동네투어 → 놀거리: 압구정투어
--   자연 → 자연: 단풍구경
--   자연 → 자연: 원주 은행나무
--   자연 → 자연: 화랑대 벚꽃
--   자연 → 자연: 원미산 진달래
--   자연 → 자연: 쭈꾸미낚시
--   자연 → 자연: 겹벚꽃 각원사
--   식사 → 식당: 아트만
--   자연 → 자연: 인왕산 벚꽃
--   자연 → 자연: 경마장
--   자연 → 자연: 여주 벚꽃길
--   자연 → 자연: 라벤더 신안
--   자연 → 자연: 신안 튤립축제
-- SKIP (카테고리 불일치): 0 건

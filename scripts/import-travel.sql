-- 데이트/여행 CSV → travel_items 일괄 등록
-- 카테고리는 모르는 값 → 기타 로 폴백. 중복 방지: (title, user_id) 존재 시 skip.
-- user_id 는 app_users 에서 name='나' 자동 매핑.

-- 구버전 스키마의 CHECK 제약이 남아 있을 수 있어 방어적으로 드롭.
-- ('공연' '데이트' 등 v2 카테고리가 원래 제약에 없으므로)
ALTER TABLE travel_items DROP CONSTRAINT IF EXISTS travel_items_category_check;

DO $$
DECLARE uid UUID;
BEGIN
  SELECT id INTO uid FROM app_users WHERE name = '나' LIMIT 1;
  IF uid IS NULL THEN RAISE EXCEPTION 'app_users 에 name=나 없음'; END IF;

  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '강릉여행', '기타', '강릉', NULL, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '강릉여행' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '클래식 공연 보기', '공연', NULL, NULL, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '클래식 공연 보기' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '서울식물원 수국', '자연', '마곡나루역 9호선', 5, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '서울식물원 수국' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '석촌호수 벚꽃', '자연', '잠실역 2호선', 4, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '석촌호수 벚꽃' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '하동매실거리 매화', '자연', '신답역 2호선', 3, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '하동매실거리 매화' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '초안산 수국동산', '자연', '노원쪽', 6, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '초안산 수국동산' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '경의선 숲길 벚꽃', '자연', '홍대입구', 4, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '경의선 숲길 벚꽃' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '클럽에반스 재즈바', '공연', '합정역', NULL, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '클럽에반스 재즈바' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '차이나타운 + 월미도', '기타', '인천', NULL, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '차이나타운 + 월미도' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '대방어 먹기', '식당', NULL, 12, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '대방어 먹기' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '은평 카라반 가기', '기타', '구파발역쪽', NULL, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '은평 카라반 가기' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '야구보기', '공연', NULL, NULL, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '야구보기' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '김가이가 버섯매운탕, 때가이르메 베리에이드', '식당', '숙대입구', NULL, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '김가이가 버섯매운탕, 때가이르메 베리에이드' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '다로베 피자(예약)', '식당', '서울숲역', NULL, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '다로베 피자(예약)' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '한강 와이키키마켓', '식당', '마포구청역', NULL, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '한강 와이키키마켓' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '평창동 미술관투어(가나아트센터, 시립미술아카이브, 토속칼국수)', '놀거리', '평창동', NULL, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '평창동 미술관투어(가나아트센터, 시립미술아카이브, 토속칼국수)' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '노량진 컵밥 투어', '식당', '노량진역', NULL, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '노량진 컵밥 투어' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '삼각지 투어(전쟁기념관2층, 맛집)', '놀거리', '삼각지역', NULL, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '삼각지 투어(전쟁기념관2층, 맛집)' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '씨너스죄인들', '공연', NULL, NULL, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '씨너스죄인들' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '잠실 투어', '놀거리', '잠실역', NULL, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '잠실 투어' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '명동 투어', '놀거리', '명동역', NULL, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '명동 투어' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '베어트리파크 장미', '자연', '세종시', 5, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '베어트리파크 장미' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '소양강댐', '자연', '춘천', 12, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '소양강댐' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '하늘공원', '자연', '월드컵경기장', 12, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '하늘공원' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '압구정투어', '놀거리', '압구정', NULL, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '압구정투어' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '단풍구경', '자연', '서울', 11, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '단풍구경' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '원주 은행나무', '자연', '원주시', 11, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '원주 은행나무' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '화랑대 벚꽃', '자연', '화랑대역', 4, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '화랑대 벚꽃' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '원미산 진달래', '자연', '부평', 4, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '원미산 진달래' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '쭈꾸미낚시', '자연', '인천', 10, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '쭈꾸미낚시' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '겹벚꽃 각원사', '자연', '천안시', 4, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '겹벚꽃 각원사' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '아트만', '식당', '경복궁', NULL, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '아트만' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '인왕산 벚꽃', '자연', NULL, 4, TRUE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '인왕산 벚꽃' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '경마장', '자연', NULL, NULL, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '경마장' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '여주 벚꽃길', '자연', NULL, 4, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '여주 벚꽃길' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '라벤더 신안', '자연', '전남 신안', 5, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '라벤더 신안' AND user_id = uid);
  INSERT INTO travel_items (title, category, region, month, visited, user_id)
  SELECT '신안 튤립축제', '자연', '전남 신안 임자도', 4, FALSE, uid
  WHERE NOT EXISTS (SELECT 1 FROM travel_items WHERE title = '신안 튤립축제' AND user_id = uid);

END $$;

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

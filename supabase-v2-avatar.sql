-- Avatar URL 컬럼 추가
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 기존 기본 유저 "나", "상대" 제거 (원하는 경우)
DELETE FROM app_users WHERE name IN ('나', '상대');

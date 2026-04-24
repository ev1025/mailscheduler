# my-dashboard

개인용 풀스택 대시보드 — 캘린더, 여행 계획, 가계부(+고정비·쇼핑기록), 지식창고를 하나의 앱에서 관리. 모바일 PWA로 홈화면 설치하면 네이티브 앱처럼 사용.

## 스택

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript
- **Tailwind CSS v4** + shadcn/ui + Base UI
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- **TipTap** — 지식창고 리치 에디터
- **@dnd-kit** — 드래그 정렬 (목록·브레드크럼 드롭·폴더 이동)
- **recharts** — 가계부 차트
- **@phosphor-icons/react** — 모바일 탭바 (활성 시 filled/regular 전환)

## 라우트 구조

| 페이지 | 경로 | 설명 |
|---|---|---|
| 캘린더 | `/calendar?view=calendar\|database` | 월간 달력 + 날씨, 일정 DB 뷰. `?y=YYYY&m=MM` 쿼리로 초기 월 지정 |
| 여행 | `/travel` | 여행·데이트 항목 목록 (가본 곳 토글, 태그 필터) |
| 여행 계획 | `/travel/plans` | 계획 목록 |
| 여행 계획 상세 | `/travel/plans/[planId]` | 타임라인 테이블 + 지도 + 수단별 경로 |
| 가계부 | `/finance` | 내역·차트·월간요약. 우상단 메뉴로 쇼핑기록 이동 |
| 쇼핑기록 | `/products` | 제품별 가격 추적(최저 단가 왕관), 구독 토글 → 고정비 자동 연동 |
| 지식창고 | `/knowledge?item=<id>` | 폴더 트리 + TipTap 에디터 + 임시저장 + 브레드크럼 DnD |
| 프로필 | `/profile` | 아바타·이름·색상, 로그아웃·비번 변경·탈퇴 |
| 설정 | `/settings` | 다크모드 토글, API 만료일 확인 |

## 주요 기능

### 공유 캘린더
- `app_users` + Supabase Auth(매직링크/OTP). 가입 시 자동으로 앱 유저 생성.
- `calendar_shares` 테이블로 owner/viewer 관계, 수락·거절 흐름(`notifications-panel`).
- 캘린더·여행·여행 계획 세 페이지가 `useVisibleUserIds` 훅으로 localStorage 키를 공유 — 탭 이동 시 필터 동기화.

### 여행 계획 (`/travel/plans/[id]`)
- 타임라인 table: 장소·시간·체류시간·이동수단. @dnd-kit 으로 재정렬.
- 구간(leg)별 수단 선택: 🚗 자가용 (NCP Directions 5) / 🚌 버스·🚆 지하철·기차 (Google transit → 공공데이터 KORAIL 폴백) / 🚶 도보 (Google walking → 직선거리×1.3 추정).
- 네이버지도 연동: task 장소 검색 / leg 구간 길찾기(`nmap://route/{car|public|walk}`).
- 지도 뷰에서 일자별·경로별 필터.

### 가계부
- 내역에 **지출명(title)** 필드 분리 — 목록에선 제목이 제일 크게, 카테고리가 아래 작게 표시. 메모(description)는 편집 폼에서만.
- 카테고리·결제수단은 TagInput(검색/추가형 바텀시트).
- **고정비 월별 자동 반영** — 월 진입 시 `applyFixedToMonth` 가 중복 체크 후 insert. 별도 "확정 저장" 단계 없음.

### 지식창고
- 폴더 트리 + TipTap 리치 에디터 + 자동 임시저장.
- 데스크톱 탐색기는 Windows 스타일 다중 선택(단일·Ctrl·Shift·드래그 박스) + 브레드크럼 DnD 드롭으로 경로 이동.
- 모바일은 드래그 인디케이터 기반 항목 이동 + 선택 모드(꾹 눌러 진입, 레이아웃 변화 없음).

## 개발

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # 프로덕션 빌드 검증
npx tsc --noEmit     # 타입 체크
```

`.env.local` 필요 값:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
KMA_API_KEY=...                    # 기상청 단기/중기예보
HOLIDAY_API_KEY=...                # 공공데이터 공휴일
NEXT_PUBLIC_NCP_MAP_CLIENT_ID=...  # NCP Maps (지도·Directions 5)
NCP_MAP_CLIENT_SECRET=...
NAVER_SEARCH_CLIENT_ID=...         # 네이버 장소 검색
NAVER_SEARCH_CLIENT_SECRET=...
GOOGLE_MAPS_API_KEY=...            # Directions API (transit + walking)
PUBLIC_TRAIN_API_KEY=...           # 공공데이터 KORAIL (디코딩 키)
```

## Supabase 세팅

SQL Editor 에서 아래 파일을 **순서대로** 실행:

1. `supabase-schema.sql` — 전체 기본 스키마 + RLS + 기본 카테고리 시드
2. `supabase-rls-auth.sql` — Supabase Auth(user_id) 기반 RLS 정책
3. `supabase-storage.sql` — `avatars` 버킷 정책
4. `supabase-share-edit-rls.sql` — 공유받은 캘린더 편집 권한
5. `supabase-travel-location.sql` — `travel_items.location` JSONB
6. `supabase-travel-plans.sql` — `travel_plans` / `travel_plan_tasks`
7. `supabase-travel-plan-category.sql` — task 분류 컬럼
8. `supabase-travel-leg-durations.sql` — 수단별 소요시간 캐시 JSONB
9. `supabase-travel-transport-route.sql` — 대중교통 경로 상세(JSONB)

필수 추가 마이그레이션 (이후 세션에서 도입된 필드):

```sql
-- 거래·고정비의 지출명(title)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS title TEXT;

-- 지식창고 항목 순서 유지
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 여행 항목의 장소 배열
ALTER TABLE travel_items ADD COLUMN IF NOT EXISTS places JSONB;
```

### 정리 (미사용 잔재 제거, 선택)

Supabase Auth 로 전환하면서 이전 SHA-256 비번 방식과 자체 복구 질문 컬럼이 남아있음. 영양제 전용 테이블도 쇼핑기록(`products`)으로 흡수된 후 미사용.

```sql
-- 테이블 (영양제 페이지 → 쇼핑기록으로 흡수됨)
DROP TABLE IF EXISTS supplements;

-- app_users: Auth 이전 잔재
ALTER TABLE app_users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE app_users DROP COLUMN IF EXISTS password_salt;
ALTER TABLE app_users DROP COLUMN IF EXISTS login_id;
ALTER TABLE app_users DROP COLUMN IF EXISTS recovery_question;
ALTER TABLE app_users DROP COLUMN IF EXISTS recovery_answer_hash;
ALTER TABLE app_users DROP COLUMN IF EXISTS recovery_answer_salt;

-- fixed_expenses: 미사용 분류 컬럼 (코드에서 읽기/쓰기 없음)
ALTER TABLE fixed_expenses DROP COLUMN IF EXISTS main_category;
ALTER TABLE fixed_expenses DROP COLUMN IF EXISTS sub_category;
```

## 배포

Vercel에 GitHub 저장소 연결. 푸시 → 자동 배포. `.env.local` 값은 Project Settings → Environment Variables 에 동일하게 등록.

## 폴더 구조

```
src/
  app/
    calendar/ travel/ finance/ products/ memo/ knowledge/
    profile/ settings/
    api/                   # 날씨·지도·검색·교통 프록시 라우트
  components/
    calendar/              # 달력·DB뷰·공유·공휴일
    travel/                # 여행/데이트·계획·타임라인·지도·경로
    finance/               # 거래폼·고정비·차트·월간요약
    products/              # 제품폼·가격추적·상세
    knowledge/             # 트리·에디터·브레드크럼·선택모드
    layout/                # PageHeader·사이드바·바텀네비·알림
    ui/                    # FormPage·Dialog·Sheet·TagInput 등 공용
  hooks/                   # use-* (캘린더·가계부·지식·여행·인증·공유)
  lib/
    supabase.ts  auth-supabase.ts  current-user.ts
    travel/                # legs·providers·naver-map-link
    dialog-stack.ts        # 하드웨어 뒤로가기 스택
```

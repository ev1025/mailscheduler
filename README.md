# 매일 캘린더 (my-dashboard)

개인용 풀스택 대시보드 — 캘린더, 가계부, 메모, 생필품 가격 비교, 여행/데이트, 지식창고를 하나의 앱에서 관리.

## 스택

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript
- **Tailwind CSS v4** + shadcn/ui + Base UI
- **Supabase** (PostgreSQL + RLS) — 데이터 저장
- **TipTap** — 지식창고 리치 에디터
- **@dnd-kit** — 드래그 정렬
- **recharts** — 차트
- **PWA** (manifest + safe-area) — 모바일 홈화면 설치

## 주요 기능

| 페이지 | 경로 | 내용 |
|---|---|---|
| 캘린더 | `/calendar?view=calendar\|database\|travel\|travel-plans\|travel-plan` | 월간 달력 + 날씨, 일정 DB 뷰, 여행/데이트 탭, 여행 계획 목록·상세. 멀티유저 공유 |
| 가계부 | `/finance` | 수입/지출, 카테고리 + 결제수단 태그형 관리, 고정비 월별 자동 반영 |
| 메모 | `/memo` | 간단한 메모장 |
| 생필품 | `/products?category=영양제` | 제품별 가격 추적(최저가 왕관), 복용/사용 토글 시 고정비 자동 연동 |
| 지식창고 | `/knowledge?item=<id>` | 폴더 트리 + TipTap 마크다운/리치 에디터 + 임시저장 |
| 설정 | `/settings` | 테마, API 만료일 확인 |

### 멀티유저

- `app_users` 테이블 기반. 비밀번호는 SHA-256 + 16바이트 salt로 클라이언트 해시.
- `자동 로그인` 체크박스 — 기기별 `remembered_users` 화이트리스트.
- 캘린더는 `calendar_shares` 테이블로 owner/viewer 관계를 저장하고, 수락·거절 흐름 지원.

### 캘린더 공유 / 알림

`notifications-panel.tsx`에서 수신 요청을 확인/수락/거절. 공유받은 사용자 캘린더는 상단 프로필 칩으로 토글.

### 모바일 UX

- 상단 `MobileHeader` (알림·설정)
- 하단 `BottomNav`
- 모든 다이얼로그는 전역 `popstate` 스택(`src/components/ui/dialog.tsx`)으로 **하드웨어 뒤로가기** 처리 — 가장 최근 다이얼로그만 닫음.
- `pt-safe` / `pb-safe-nav` 등 safe-area 유틸리티 적용.

## 개발

```bash
npm install
npm run dev   # http://localhost:3000
npm run build # 프로덕션 빌드 검증
```

`.env.local` 필요 값:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
KMA_API_KEY=...                    # 기상청 단기/중기예보
HOLIDAY_API_KEY=...                # 공휴일 (공공데이터)
NEXT_PUBLIC_NCP_MAP_CLIENT_ID=...  # NCP Maps (지도·Directions 5 공용)
NCP_MAP_CLIENT_SECRET=...          # NCP 콘솔에서 Directions 5 별도 신청 필요
NAVER_SEARCH_CLIENT_ID=...         # 네이버 개발자센터 검색
NAVER_SEARCH_CLIENT_SECRET=...
GOOGLE_MAPS_API_KEY=...            # Directions API (transit + walking)
PUBLIC_TRAIN_API_KEY=...           # 공공데이터 KORAIL (디코딩 키)
```

## Supabase 세팅

1. Supabase 프로젝트 생성 → SQL Editor 열기
2. 루트의 `supabase-schema.sql` 전체를 붙여넣고 실행
   - 모든 테이블(`app_users`, `calendar_events`, `expenses`, `fixed_expenses`, `products`, `product_purchases`, `knowledge_*`, `travel_items`, `memos`, `weather_cache`, `calendar_shares` 등)과 RLS 정책, 기본 카테고리 시드까지 포함
3. 여행 계획용 추가 마이그레이션 (순서 무관):
   - `supabase-travel-plans.sql`              — `travel_plans` · `travel_plan_tasks`
   - `supabase-travel-plan-category.sql`      — 단일 분류 컬럼
   - `supabase-travel-leg-durations.sql`      — 수단별 소요시간 캐시 JSONB
4. 익명 접근 허용 (개인용). 공개 배포 시에는 RLS 정책 강화 권장.

## 여행 계획 경로 API

수단별로 다른 소스를 사용 (공급처 분산):

| 수단 | 1차 | 폴백 |
|------|-----|------|
| 🚗 승용차 | NCP Directions 5 | — |
| 🚶 도보 | Google walking | 직선거리×1.3 / 4.5km·h 추정 (15km 이내) |
| 🚌 버스 | Google transit (bus) | — |
| 🚆 기차 | Google transit (train\|subway\|rail) | 공공데이터 KORAIL |

- `src/hooks/use-route-data.ts` — 모듈 레벨 Map 캐시 (TTL 2분) + pending promise dedup
- 좌표 변경 시 `invalidateRouteData(from, to)` 자동 호출 (plan-detail onSave)

## 알려진 이슈

- **여행 계획 상세 데스크탑 웹 스크롤 + 사이드바 정렬** — 여러 시도 후에도 해결 안 됨. `scrollWheel:false` · window capture · document capture · pointer-events:none · 투명 오버레이 · app-shell `md:h-dvh` · 이중 스크롤 컨테이너 제거 · sticky header 모두 적용했으나 간헐적으로 스크롤 불가. DevTools Event Listeners 에서 body/window `wheel` 리스너 실제 등록 주체 먼저 확인 필요. 레이아웃 재설계 고려.

## 배포

Vercel에 연결된 GitHub 저장소에 푸시하면 자동 배포. `.env.local` 값은 Vercel Project Settings → Environment Variables에 동일하게 등록해야 함.

## 폴더 구조

```
src/
  app/                 # Next.js App Router 페이지
  components/
    calendar/          # 달력·DB뷰·공유·공휴일
    finance/           # 거래 폼·고정비·차트·월간요약
    products/          # 제품 폼·상세
    travel/            # 여행/데이트 폼·목록
    knowledge/         # 트리·리치 에디터
    layout/            # 사이드바·바텀네비·프로필 스위처·알림
    ui/                # shadcn 기반 공용 컴포넌트 (Dialog 등)
  hooks/               # use-transactions / use-products / use-knowledge-* 등
  lib/                 # supabase, current-user, auth, weather
```

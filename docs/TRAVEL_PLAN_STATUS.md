# 여행 계획 기능 — 현재 상태 정리 (2026-04-21)

## 개요

한 번의 대규모 리팩토링과 여러 차례 UX 수정을 거친 현 시점 스냅샷.
브랜치: `main`. 마지막 커밋 `865b31f`.

---

## 기능 구조

```
여행 계획 (travel-plans)
├── 목록 페이지        src/components/travel/plan-list.tsx
├── 상세 페이지        src/components/travel/plan-detail.tsx  ← 라우팅 허브
│   ├── 일자 드롭존    DayDropZone (상세 내부)
│   ├── 일정 행        plan-task-row.tsx  (시간범위 2-line 레이아웃)
│   ├── 구간 카드      plan-leg-card.tsx  (compact: 수단·소요시간만)
│   ├── 수단 선택 모달  plan-transport-picker.tsx
│   ├── 지도           plan-route-map.tsx (Naver Maps SDK)
│   ├── 세그먼트 탭    plan-segment-tabs.tsx (전체/일자별/경로별)
│   └── 편집 시트      plan-task-sheet.tsx (DeviceDialog 기반)
└── "계획에 추가"      add-to-plan-dialog.tsx (여행 항목 → 계획)

공용 UI
├── ui/device-dialog.tsx   모바일 Sheet / 데스크탑 Dialog 자동 전환
├── ui/draggable-sheet.tsx 드래그로 닫는 바텀시트 (native touch 이벤트)
└── ui/tag-input.tsx       콤보박스 패턴 (데스크탑 combobox, 모바일 sheet)
```

---

## 데이터 구조 (Supabase)

```sql
-- 여행 계획
travel_plans (
  id, title, start_date, end_date, notes, user_id, created_at, updated_at
)

-- 여행 계획 일정
travel_plan_tasks (
  id, plan_id, day_index, start_time, stay_minutes, manual_order,
  place_name, place_address, place_lat, place_lng,
  tag,          -- 태그 (콤마 구분)
  category,     -- 분류 (단일) ← 마이그레이션 필요: supabase-travel-plan-category.sql
  content,
  transport_mode, transport_duration_sec, transport_manual,
  transport_durations  -- JSONB, 수단별 캐시 (마이그: supabase-travel-leg-durations.sql)
)

-- 관련 테이블
travel_items          -- 여행 카탈로그
event_tags            -- 태그 공용 풀
travel_plans / travel_plan_tasks RLS: public (anon/auth 모두 허용)
```

---

## 라우팅 (router.push 기반)

`/calendar?view=travel-plans`          -- 계획 목록
`/calendar?view=travel-plan&planId=X`  -- 계획 상세

`setView()` 는 기본 `router.push` (history 엔트리 생성).
뒤로가기: 브라우저 native back → 이전 뷰. PlanDetail 헤더 `←` 도 `router.back()`.

---

## 경로 / 소요시간 조회 아키텍처

### Provider chain (src/lib/travel/providers.ts)

| 수단 | 1차 | 2차 폴백 | 3차 폴백 |
|------|-----|---------|---------|
| 🚗 승용차 | NCP Directions 5 | — | — |
| 🚶 도보 | Google walking | 직선거리×1.3/4.5km·h 추정 (15km 이내) | — |
| 🚌 버스 | Google transit (bus) | — | — |
| 🚆 기차 | Google transit (train\|subway\|rail) | KORAIL 공공데이터 | — |

### 캐싱 (src/hooks/use-route-data.ts)

- 모듈 레벨 `Map<key, { result, expiresAt }>` + pending promise dedup
- key = `"fromLat,fromLng|toLat,toLng|mode"` (소수 5자리 라운딩)
- TTL 2 분
- `invalidateRouteData(from, to)` — 좌표 변경 시 자동 호출 (plan-detail onSave)

### API 프록시
- `/api/naver/directions`      NCP Directions 5 + 멀티옵션(trafast:traoptimal:tracomfort)
- `/api/google-transit`         mode=walking/driving/bicycling or transit_mode=bus/train/subway/rail
  - `departure_time` 기본값: 다음 평일 09:00 (양방향 비대칭 감소)
  - duration 계산: `arrival_time - departure_time` 우선, 없으면 `duration.value`
- `/api/public-train`           KORAIL /plans — 역명 매칭, 실측 시간표만 (추정치 제거)

---

## 주요 수정 이력 (최근 → 과거)

### 🟢 해결됨
- **웹 페이지 스크롤**: app-shell `md:h-full md:min-h-dvh` → `md:h-dvh` (뷰포트 고정으로 main.overflow-y-auto 트리거)
- **여행 계획 상세 이중 스크롤**: 자체 overflow-y-auto 제거, main 에 위임, 헤더 sticky
- **사이드바↔헤더 높이 불일치**: plan-detail 헤더 h-14 → h-12 (사이드바와 동일)
- **뒤로가기 앱 종료 버그**: `router.replace` → `router.push`
- **계획에 추가 태그 누락**: category + tag 모두 전달
- **계획에 추가 빈 일정 오작동**: 구버전 단일 위치(place_name/lat/lng) 도 places 로 폴백
- **계획에 추가 일자 선택**: Select 로 기존 일차 or "+ 새 일자" 선택
- **Popover / Select z-index**: z-50 → z-[75] (Sheet z-[65] 위로)
- **지도 path 잔존**: useEffect cleanup 로 이전 overlay 확실히 제거
- **지도 깜빡임**: 지도 1회만 생성, pins/legs 변경 시 overlay 만 교체
- **토스트 스와이프 dismiss**: `swipeDirections=[left, right, top]`
- **체류시간 spinner 아이콘**: type=number → type=text + inputMode
- **Select 체크 아이콘 옵션화**: `hideIndicator` prop
- **기간 DatePicker 과도 폭**: 데스크탑 md:w-36 고정
- **여행 항목 태그 저장 실패 진단**: 실제 Supabase error.message 를 토스트·console 노출
- **드래그 순서 변경 시 인접 leg reset**: 옛 next + 새 next 의 transport_* 초기화
- **일자간 드래그**: `DayDropZone` 에 `useDroppable` → 빈 일자에도 드롭 가능
- **장소 위치 변경 시 transport reset**: 관련 두 leg 필드 + 캐시 invalidate
- **수단 선택 캐시 stale**: picker 열 때마다 fresh fetch (DB 캐시는 선택값만 저장)
- **지도 스크롤 우회**: 투명 오버레이 패턴 — 클릭으로 지도 활성/비활성

### 🟡 진행 중 / 대기
- **KORAIL 역코드 매칭 정확도**: 현재 25개 주요 역 하드코딩. 실제 API 의 stn_cd 기반 조회로 교체 필요
- **대전역→서울역 양방향 비대칭**: 개선됐으나 Google 내부 타이밍 이슈로 완전 해결은 어려움
- **PWA Service Worker 캐시**: dev 환경에서 변경 반영 지연 간헐 발생

### 🔴 미해결
- (현재 알려진 이슈 없음 — 사용자 피드백 반영하며 지속 수정 중)

---

## 필수 환경변수 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
KMA_API_KEY=                    # 기상청 단기예보
HOLIDAY_API_KEY=                # 공휴일
NEXT_PUBLIC_NCP_MAP_CLIENT_ID=  # NCP Maps (Dynamic/Static/Directions 5 공용)
NCP_MAP_CLIENT_SECRET=
NAVER_SEARCH_CLIENT_ID=         # 네이버 개발자센터 (검색 전용)
NAVER_SEARCH_CLIENT_SECRET=
GOOGLE_MAPS_API_KEY=            # Directions API (transit + walking)
PUBLIC_TRAIN_API_KEY=           # 공공데이터 KORAIL (디코딩 키)
```

NCP 콘솔에서 **Directions 5 상품 별도 신청** 필요 (Maps 상품 구독과 별개).

---

## 남은 SQL 마이그레이션

- `supabase-travel-plan-category.sql`    — travel_plan_tasks.category 컬럼
- `supabase-travel-leg-durations.sql`    — travel_plan_tasks.transport_durations JSONB
- `supabase-travel-plans.sql`            — travel_plans · travel_plan_tasks 테이블 본체

Supabase SQL Editor 에서 각 파일 내용 실행.

---

## 테스트 체크리스트

### 데스크탑
- [ ] 여행 계획 목록 → 상세 진입 → 브라우저 뒤로가기 → 목록 복귀
- [ ] 상세 페이지에서 마우스 휠 스크롤 정상 (지도 위/외부 모두)
- [ ] ctrl+휠 브라우저 줌 정상
- [ ] 지도 클릭 시 조작 가능, 영역 벗어나면 자동 비활성
- [ ] 일자 Select 드롭다운 폭 트리거와 동일
- [ ] 태그/분류 TagInput 콤보박스 패턴 (트리거 내부에 검색)

### 모바일
- [ ] 편집 시트 드래그 바로 닫기 (120px+ 스와이프)
- [ ] 이동수단 선택 시트 내부 스크롤 + 드래그 닫기
- [ ] 일정 행 탭으로 편집 시트 오픈
- [ ] 토스트 좌/우 스와이프 dismiss
- [ ] 일정 드래그 → 일자 간 이동 가능

### 양 플랫폼
- [ ] 수단 선택 → 지도 path 실선 교체 (이전 수단 path 안 남음)
- [ ] 장소 변경 → 관련 leg 수단 정보 초기화
- [ ] Picker 재열기 시 최신 값 표시 (캐시 TTL 내)

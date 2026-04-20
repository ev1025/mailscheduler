# 여행 계획 앱 — 경로(PATH)·스크롤 버그 진단 요청

Next.js 16 + Supabase + Tailwind v4 스택으로 만든 개인 여행 계획 PWA. 사용자가 방문지 순서대로 등록하면 각 구간의 이동수단·소요시간·도착시간을 자동 계산해주는 기능을 구현 중인데, 아래 세 가지 문제가 끈질기게 해결되지 않습니다.

---

## 문제 1. 지도 PATH 가 일관되지 않음

### 증상
- 어떤 leg 은 실선(폴리라인)으로 그려지고, 어떤 leg 은 점선(fallback) 으로 표시됨.
- 이동수단을 **승용차 → 버스** 로 바꿔도 지도의 경로가 **이전 수단 경로 그대로** 표시.
- 승용차·버스·지하철은 실제 경로가 다른데 우리 앱에선 **항상 같은 선**으로 보이는 경우가 많음.

### 현재 아키텍처

**DB (Supabase):**
```
travel_plan_tasks
  id uuid, plan_id uuid, day_index int, place_lat float8, place_lng float8,
  start_time time, stay_minutes int,
  transport_mode text ('car' | 'walk' | 'bus' | 'train' | 'taxi'),
  transport_duration_sec int,
  transport_manual bool,
  transport_durations jsonb  -- {car: 3900, bus: 7200, ...}
```

각 task 의 `transport_*` 필드는 이 task 로 **도착**하는 leg 의 정보. 즉 prev→this 구간의 수단·소요시간.

**Provider chain (`src/lib/travel/providers.ts`):**
- `car`/`taxi` → `/api/naver/directions` (NCP Directions 5) — `path` 반환
- `walk` → `/api/google-transit?mode=walking` — path 반환 (Google 성공 시), 실패 시 haversine 추정 (path 없음)
- `bus` → `/api/google-transit?mode=bus` — overview_polyline 디코드한 path 반환
- `train` → `/api/google-transit?mode=train|subway|rail` → 실패 시 KORAIL 공공데이터 (path 없음)

**Path fetch useEffect (`plan-detail.tsx`):**
```ts
const [legPaths, setLegPaths] = useState<Record<string, [number, number][]>>({});

useEffect(() => {
  (async () => {
    for (const leg of visibleLegs) {
      const mode = leg.toTask.transport_mode ?? null;
      if (!mode) continue;
      const key = `${leg.fromTaskId}-${leg.toTaskId}-${mode}`; // mode 포함
      if (legPaths[key]) continue;
      const result = await fetchRouteDuration(
        { lat: leg.fromTask.place_lat!, lng: leg.fromTask.place_lng! },
        { lat: leg.toTask.place_lat!, lng: leg.toTask.place_lng! },
        mode
      );
      if (result?.path && result.path.length > 1) {
        setLegPaths((p) => ({ ...p, [key]: result.path! }));
      }
    }
  })();
}, [visibleLegs, legPaths]);
```

**지도 전달 로직:**
```ts
legsForMap.push({
  fromIdx,
  toIdx,
  path: l.toTask.transport_mode
    ? legPaths[`${l.fromTaskId}-${l.toTaskId}-${l.toTask.transport_mode}`]
    : undefined,
});
```

**지도 렌더 (`plan-route-map.tsx`):**
```ts
for (const leg of legs ?? []) {
  const hasPath = leg.path && leg.path.length > 1;
  if (hasPath) {
    new naver.maps.Polyline({ path: leg.path, strokeColor: "#3b82f6", ... });
  } else {
    // fallback — 점선 from→to 직선
    new naver.maps.Polyline({
      path: [naver.maps.LatLng(from), naver.maps.LatLng(to)],
      strokeStyle: "shortdash", ...
    });
  }
}
```

### 현상 분석
- `walk` / `train` provider 가 실패 시 path 없는 `{durationSec}` 만 반환 → 항상 점선
- `transport_mode` 변경 시 `legPaths` 캐시에 이전 수단 path 가 남아있어 재사용되는 문제는 key 에 mode 추가로 수정했으나 여전히 이상 동작 보고됨
- Naver Directions / Google transit 의 path 좌표는 각각 `[lng, lat]` 순서로 반환 (Naver) / `overview_polyline.points` 디코드 (Google) — 포맷 일치 가정

### 의심 포인트
- `visibleLegs` 와 `legPaths` 가 동시에 deps 에 있어 무한 재실행 루프 가능?
- `setLegPaths` 호출 시 루프 안의 iteration 이 겹치는 race condition?
- Google transit 의 overview_polyline 디코드 결과가 실제 대중교통 경로인지, 아니면 출발점→도착점 직선에 가까운 요약인지?

---

## 문제 2. 소요시간 부정확 (Google transit 결과 이상)

### 증상
사용자 경험:
- **대전역 → 서울역 (KTX)** — 앱 표시 **29분**, 실제 55~60분 (서울→대전 방향은 정상 ~56분)
- **서대문역 → 아현역 (지하철 5호선 인접 1정거장)** — 앱 표시 **6분**, 사용자 기대(Google Maps 앱 기준) **13분**
- 비대칭 결과: A→B 와 B→A 가 다르게 나옴

### API 호출
```ts
// /api/google-transit/route.ts
url.searchParams.set("mode", "transit");
url.searchParams.set("transit_mode", mode); // bus | train|subway|rail | ...
url.searchParams.set("language", "ko");
url.searchParams.set("region", "kr");
url.searchParams.set("key", apiKey);
// departure_time 미지정 (기본 = 현재)

const data = await res.json();
const durationSec = data.routes?.[0]?.legs?.[0]?.duration?.value;
```

현재 기차 호출: `transit_mode=train|subway|rail` (파이프 구분).
이전엔 `train` → `rail` 단계별 fallback 이었으나 여전히 이상.

### 의심 포인트
- `legs[0].duration.value` 가 우리가 기대하는 "total 체감 시간"(도보+환승+승차) 이 아닐 가능성?
- 양방향 차이 — Google 이 시간대에 따라 다른 열차 스케줄을 매칭 (현재 시각 기준)
- `transit_mode` 가 파이프 결합(`train|subway|rail`)을 제대로 해석 못 하고 첫 mode 만 사용하는지?
- 사용자의 `place_lat/lng` 가 정확한 역 좌표가 아닐 가능성(네이버 검색 결과 기반 — "대전역"으로 검색 시 정확도 불명)

---

## 문제 3. 웹 페이지 스크롤이 안 됨 (모바일은 정상)

### 증상
- 데스크탑 브라우저에서 여행 계획 상세 페이지 **전체 페이지가 마우스 휠로 스크롤되지 않음**
- `ctrl+휠` 로 브라우저 줌도 안 됨
- 모바일에서는 정상 동작
- 사용자 힌트: "네이버 지도 스크롤 못하게 막은 것 때문에 그런 것 같다"

### 현재 설정
**Naver Map 옵션 (`plan-route-map.tsx`):**
```ts
new naver.maps.Map(containerRef.current, {
  center,
  zoom,
  zoomControl: false,
  scaleControl: false,
  mapDataControl: false,
  logoControl: false,
  scrollWheel: false, // ← 이게 문제로 의심됨
});
```

**시도한 우회 조치들 (모두 실패):**
1. 컨테이너에 capture-phase wheel listener + `stopImmediatePropagation`:
   ```ts
   el.addEventListener("wheel", onWheel, { capture: true, passive: true });
   ```
2. document-level capture-phase wheel listener + 좌표 기반 체크:
   ```ts
   document.addEventListener("wheel", onDocWheel, { capture: true, passive: true });
   ```
3. 컨테이너에 `pointer-events: none` (사용자가 지적해서 최근 제거)

### 의심 포인트
- Naver Maps SDK 의 `scrollWheel: false` 설정이 내부적으로 여전히 `preventDefault()` 호출해서 페이지 스크롤까지 막는가?
- SDK 가 리스너를 `window` 에 capture-phase 로 걸어 우리의 document 레벨 capture 를 우회하는가?
- 지도 컨테이너가 페이지 전체 레이아웃에서 어떤 CSS 로 잡고 있는가 (overflow-y-auto 가 flex-1 안에 있음)?

### 상위 레이아웃
```
<div className="flex flex-col h-full">                         // plan-detail root
  <header ... h-14 shrink-0>...</header>
  <div className="flex-1 overflow-y-auto">                     // ← 여기서 스크롤되어야 함
    <div className="mx-auto w-full max-w-3xl">
      <header>기간 · DatePicker</header>
      <section>segment tabs + PlanRouteMap (height 240)</section>
      <DndContext>
        <SortableContext>
          {days.map(day =>
            <DayDropZone day={day}>
              <SortableTaskRow /><PlanLegCard />...
            </DayDropZone>
          )}
        </SortableContext>
      </DndContext>
    </div>
  </div>
</div>
```

부모:
```
<div className="flex flex-col min-h-0 overflow-hidden h-[calc(100%-3.5rem)]">
```

---

## 핵심 파일

- `src/components/travel/plan-detail.tsx` — 상세 페이지, path fetch, 지도 legs 조립
- `src/components/travel/plan-route-map.tsx` — 네이버 지도 SDK 렌더
- `src/components/travel/plan-leg-card.tsx` — leg 버튼·이동수단 표시
- `src/components/travel/plan-transport-picker.tsx` — 수단 비교 picker
- `src/lib/travel/providers.ts` — fetchRouteDuration 통합
- `src/app/api/naver/directions/route.ts` — NCP Directions 5 프록시
- `src/app/api/google-transit/route.ts` — Google Maps transit 프록시
- `src/app/api/public-train/route.ts` — KORAIL 공공데이터 프록시

---

## 질문

1. **PATH 문제**: mode-포함 key(`${from}-${to}-${mode}`) 전환이 효과 없다면 다른 원인은? React 상태 업데이트·useEffect 타이밍·Promise 경쟁 측면에서 봐야 할 곳이 있나?

2. **Google transit 결과**: `legs[0].duration.value` 말고 `duration_in_traffic` / `arrival_time - departure_time` 차이 사용하는 게 맞나? 양방향 불일치를 줄이려면 어떻게?

3. **스크롤**: Naver Maps v3 SDK 로 맵 상에서 페이지 스크롤이 정상 작동하게 하는 깔끔한 방법? `scrollWheel: false` 가 SDK 내부에서 preventDefault 를 항상 호출한다고 가정했을 때, 맵을 iframe 으로 격리해야 하나?

---

## 환경

- Next.js 16 (Turbopack)
- React 19
- @base-ui/react (Dialog/Sheet)
- @dnd-kit/sortable (드래그)
- 네이버 지도 JavaScript API v3 (`ncpKeyId` 인증, 2024 개편 후 신규)
- Supabase (anon key, RLS policy public)

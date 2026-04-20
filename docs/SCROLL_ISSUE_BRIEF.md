# 웹 페이지 스크롤 안 됨 — 상세 진단 요청

Next.js 16 + React 19 + Tailwind v4 로 만든 여행 계획 상세 페이지에서 **데스크탑 브라우저에서 마우스 휠 스크롤이 완전히 막힘** (ctrl+휠 브라우저 줌도 불가). 모바일에선 정상. 원인과 해결책 문의.

---

## 재현

1. `/calendar?view=travel-plan&planId=xxx` 접속 (데스크탑 크롬/파이어폭스)
2. 페이지에 네이버 지도가 렌더됨 (240px 높이)
3. 마우스 휠로 페이지를 스크롤하려고 함 → **아무 일도 안 일어남**
4. 지도 영역 밖(목록 영역, 헤더)에서 휠 → **역시 안 됨**
5. ctrl + 휠 (브라우저 줌) → **역시 안 됨**

---

## 페이지 레이아웃

```
<html class="h-full">
  <body class="min-h-full flex flex-col">
    <AppShell>  // div.flex.h-dvh.overflow-hidden.fixed.inset-0.md:static.md:h-full.md:min-h-dvh
      <Sidebar />
      <main class="flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-none">
        <CalendarPage>
          <div class="flex flex-col min-h-0 overflow-hidden h-[calc(100%-3.5rem)] px-2 py-2 md:p-6">
            <PlanDetail>
              <div class="flex flex-col h-full">
                <header class="h-14 shrink-0">...</header>
                <div class="flex-1 min-h-0 overflow-y-auto">  ← 여기가 스크롤 되어야
                  <div class="mx-auto w-full max-w-3xl">
                    <기간 DatePicker 섹션>
                    <세그먼트 탭 + PlanRouteMap height=240>
                    <DndContext>
                      <SortableContext>
                        <수십 개 일정 카드>
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              </div>
            </PlanDetail>
          </div>
        </CalendarPage>
      </main>
    </AppShell>
  </body>
</html>
```

콘텐츠(일정 카드 여러 개)가 `flex-1 min-h-0 overflow-y-auto` 컨테이너 높이를 훨씬 초과하므로 스크롤이 되어야 하는 상황.

---

## 시도한 해결책 (모두 실패)

### 1. Naver Maps 옵션
```ts
new naver.maps.Map(containerRef.current, {
  scrollWheel: false,   // 맵이 wheel 이벤트에 반응 안 하게
  zoomControl: false,
  scaleControl: false,
  mapDataControl: false,
  logoControl: false,
})
```

### 2. Container-level capture wheel 리스너
```ts
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const onWheel = (e: WheelEvent) => {
    e.stopImmediatePropagation();
  };
  el.addEventListener("wheel", onWheel, { capture: true, passive: true });
  return () => el.removeEventListener("wheel", onWheel, { capture: true });
}, []);
```

### 3. Document-level capture wheel 리스너
```ts
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const onDocWheel = (e: WheelEvent) => {
    const t = e.target;
    if (t instanceof Node && el.contains(t)) {
      e.stopImmediatePropagation();
    }
  };
  document.addEventListener("wheel", onDocWheel, { capture: true, passive: true });
  return () => document.removeEventListener("wheel", onDocWheel, { capture: true });
}, []);
```

### 4. Window-level capture + 부모 컨테이너 직접 스크롤 (현재 코드)
```ts
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const onWheel = (e: WheelEvent) => {
    if (!(e.target instanceof Node) || !el.contains(e.target)) return;
    if (e.ctrlKey) {
      e.stopImmediatePropagation();   // Naver 는 차단, 브라우저 줌은 허용
      return;
    }
    const scrollable =
      el.closest<HTMLElement>(".overflow-y-auto") ??
      (document.scrollingElement as HTMLElement | null);
    if (scrollable) scrollable.scrollTop += e.deltaY;
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  window.addEventListener("wheel", onWheel, { capture: true, passive: false });
  return () => window.removeEventListener("wheel", onWheel, { capture: true });
}, []);
```

### 5. `pointer-events: none` on 지도 컨테이너 (사용자 요청으로 제거)
→ 지도 위에서 이벤트가 아예 발생 안 함. 하지만 결과적으로 e.target 이 map 이 아닌 다른 요소가 되어 `el.contains(t)` 체크가 실패 → 로직 무력화.

### 6. React onWheel (bubble phase)
→ Naver SDK 가 capture phase 에서 stopPropagation 하면 React 까지 전달 안 됨. 작동 안 함.

### 7. flex 레이아웃 min-h-0
`flex-1 overflow-y-auto` → `flex-1 min-h-0 overflow-y-auto` 변경. 이는 flex 컨테이너의 min-height:auto 기본값 때문에 자식이 오버플로우를 잘라먹는 문제를 해결하는 패턴. 적용 후에도 스크롤 안 됨.

---

## 핵심 질문

1. **Naver Maps JavaScript API v3 SDK 가 wheel 이벤트를 어느 레벨에 등록하는가?**
   - window? document? 지도 div? 내부 canvas?
   - 어느 단계(capture/bubble)에서 처리하는가?
   - `scrollWheel: false` 옵션이 실제로 wheel 리스너를 제거하는가, 아니면 리스너는 그대로 두고 줌만 안 하게 하는가?

2. **우리 코드의 window capture 리스너가 Naver 의 리스너보다 먼저 등록됐음에도 왜 효과가 없는가?**
   - 리스너 등록 순서는 capture phase 에서 중요하지 않음 (등록 순서 무관, capture 는 window → target 순).
   - 우리 `stopImmediatePropagation` 이 Naver 보다 앞서 실행되어야 함.
   - 그런데 페이지 스크롤이 여전히 막힘 → Naver 가 다른 방식(예: `overflow: hidden` 을 body 에 직접 설정? mouseenter 시 body lock?)으로 막는 것일 수도.

3. **ctrl+휠 브라우저 줌도 막힌다는 것은 Naver 가 wheel 뿐 아니라 brower zoom 까지 차단한다는 의미인가?**
   - 단순히 preventDefault 한다고 브라우저 줌이 막히지는 않음.
   - `touch-action` CSS? `user-scalable=no` meta? 뭔가 더 근본적 설정이 있을 가능성.

4. **현재 시도(window capture + preventDefault + 부모 수동 스크롤)가 왜 작동 안 하는지 확인 가능한가?**
   - 가능한 디버깅 방법?
   - `console.log` 를 붙여 핸들러가 실제 실행되는지부터 확인?

---

## 원하는 결과

- 지도 위/아래 어디서 휠을 돌려도 **페이지가 정상 스크롤** 되어야 함
- ctrl+휠 로 **브라우저 줌** 도 작동해야 함
- 모바일 터치 스크롤(지도 외부)도 정상 유지
- 지도 자체의 인터랙션(마커 클릭, 드래그 패닝)은 있어도 되고 없어도 됨 — **페이지 스크롤 우선**

---

## 대안 접근도 검토 중

- **지도를 iframe 으로 격리** — 완전히 다른 브라우징 컨텍스트라 부모 스크롤과 무관. 단점: Next.js 내부 컴포넌트와 이벤트 분리 필요.
- **다른 지도 라이브러리** — Leaflet, Mapbox GL JS, Google Maps 등 더 예의 바른 wheel 처리하는 것 사용. 단점: NCP Directions 5 연동 유지 위해 네이버 유지 선호.
- **지도 lazy mount** — 사용자가 지도 "펼치기" 눌렀을 때만 마운트. 단점: UX 저하.

---

## 환경

- Next.js 16 (Turbopack)
- React 19
- 네이버 지도 JavaScript API v3 (`ncpKeyId` 인증, 2024~ 신규)
- `@base-ui/react` Dialog/Sheet
- Tailwind v4

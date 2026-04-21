"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// 드래그 스냅 바텀시트.
// snapPoints = [0.5, 0.9] 면 50% / 90% 두 지점에 스냅.
// 최저 스냅에서 추가로 끌어내리면 닫힘(closeThreshold 추가 거리).
//
// 드래그 영역:
//  - 상단 핸들바: 항상 시트 드래그 (스냅 이동·닫기)
//  - 본문 전체: scroll 이 맨 위에 있고 아래로 당기면 시트 드래그. 그 외 상황에선
//    내부 스크롤 허용. 한 제스처 안에서 한 번 결정되면 끝까지 유지.
//
// React onPointer 가 Base UI Dialog 와 충돌해 일부 기기에서 작동 안 해
// native touch/mouse 이벤트를 직접 바인딩.

interface DraggableSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** 스냅 지점들 (뷰포트 높이 비율). 기본 [0.9] = 단일 스냅. */
  snapPoints?: number[];
  /** 시트 열릴 때 초기 스냅 인덱스. 기본 snapPoints.length-1 (최대) */
  defaultSnapIndex?: number;
  /** 최저 스냅 이하로 끌어내렸을 때 닫히는 최소 거리 (px). 기본 120 */
  closeThreshold?: number;
  /** children 을 스크롤 가능한 영역으로 감쌀지. 기본 true */
  scrollable?: boolean;
  className?: string;
  children: React.ReactNode;
}

export default function DraggableSheet({
  open,
  onOpenChange,
  title,
  snapPoints = [0.9],
  defaultSnapIndex,
  closeThreshold = 120,
  scrollable = true,
  className,
  children,
}: DraggableSheetProps) {
  // 스냅 지점은 오름차순 정렬. 배열 identity 안정화.
  const snaps = useMemo(
    () => [...snapPoints].sort((a, b) => a - b),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapPoints.join(",")]
  );
  const maxIdx = snaps.length - 1;
  const initialIdx = Math.max(0, Math.min(maxIdx, defaultSnapIndex ?? maxIdx));

  const [snapIdx, setSnapIdx] = useState(initialIdx);
  const [dragOffset, setDragOffset] = useState(0);
  const dragging = useRef(false);
  const startYRef = useRef<number | null>(null);
  const startOffsetRef = useRef(0);

  const handleRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // open 재설정
  useEffect(() => {
    if (open) {
      setSnapIdx(initialIdx);
      setDragOffset(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const snapIdxRef = useRef(snapIdx);
  useEffect(() => { snapIdxRef.current = snapIdx; });

  // 공용 drag 로직 — handle / content 양쪽에서 호출
  const start = (clientY: number) => {
    dragging.current = true;
    startYRef.current = clientY;
    startOffsetRef.current = 0;
  };
  const move = (clientY: number) => {
    if (!dragging.current || startYRef.current == null) return;
    const delta = clientY - startYRef.current;
    setDragOffset(startOffsetRef.current + delta);
  };
  const end = (clientY: number) => {
    if (!dragging.current) return;
    dragging.current = false;
    const startY = startYRef.current;
    startYRef.current = null;

    if (startY == null) {
      setDragOffset(0);
      return;
    }
    const deltaAtEnd = clientY - startY;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const currentSnap = snaps[snapIdxRef.current];
    const currentHeightPx = currentSnap * vh - deltaAtEnd;

    const lowestHeightPx = snaps[0] * vh;
    if (currentHeightPx < lowestHeightPx - closeThreshold) {
      onOpenChange(false);
      setDragOffset(0);
      return;
    }

    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < snaps.length; i++) {
      const d = Math.abs(snaps[i] * vh - currentHeightPx);
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    }
    setSnapIdx(nearest);
    setDragOffset(0);
  };

  // 핸들바 전용 리스너 — 항상 시트 드래그.
  // open 을 deps 에 포함해야 SheetPortal 이 open=true 로 마운트된 직후 ref 가
  // 채워진 시점에 re-run 되어 native listener 가 등록됨.
  useEffect(() => {
    if (!open) return;
    const el = handleRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      start(e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      move(e.touches[0].clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const y = e.changedTouches[0]?.clientY ?? 0;
      end(y);
    };
    const onMouseDown = (e: MouseEvent) => {
      start(e.clientY);
      const onMove = (ev: MouseEvent) => move(ev.clientY);
      const onUp = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        end(ev.clientY);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("mousedown", onMouseDown);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, snaps, closeThreshold, onOpenChange]);

  // 본문 영역 리스너 — 내부 스크롤과 공존. 제스처 시작 시 scroll 상태 + 방향으로
  // "sheet drag" vs "content scroll" 모드 결정.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;

    // 한 제스처의 모드. null = 미결정, "sheet" = 시트 이동, "content" = 내부 스크롤
    let gestureMode: "sheet" | "content" | null = null;
    let gestureStartY: number | null = null;
    let gestureStartScrollTop = 0;
    const DECIDE_PX = 6; // 이만큼 움직여야 모드 결정

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      gestureStartY = e.touches[0].clientY;
      gestureStartScrollTop = el.scrollTop;
      gestureMode = null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (gestureStartY == null) return;
      const y = e.touches[0].clientY;
      const delta = y - gestureStartY;
      if (gestureMode == null) {
        if (Math.abs(delta) < DECIDE_PX) return;
        // 아래로 당기기 + 스크롤 맨 위 → 시트 드래그 (닫기/축소)
        // 위로 밀기 + 시트가 최대 스냅 아님 → 시트 드래그 (확장)
        const canGrow = snapIdxRef.current < maxIdx;
        if (delta > 0 && gestureStartScrollTop <= 0) {
          gestureMode = "sheet";
          start(gestureStartY);
        } else if (delta < 0 && canGrow && gestureStartScrollTop <= 0) {
          gestureMode = "sheet";
          start(gestureStartY);
        } else {
          gestureMode = "content";
        }
      }
      if (gestureMode === "sheet") {
        e.preventDefault();
        move(y);
      }
      // content 모드는 아무것도 안 함 → 네이티브 스크롤
    };
    const onTouchEnd = (e: TouchEvent) => {
      const y = e.changedTouches[0]?.clientY ?? 0;
      if (gestureMode === "sheet") end(y);
      gestureMode = null;
      gestureStartY = null;
    };

    const onMouseDown = (e: MouseEvent) => {
      gestureStartY = e.clientY;
      gestureStartScrollTop = el.scrollTop;
      gestureMode = null;
      const onMove = (ev: MouseEvent) => {
        if (gestureStartY == null) return;
        const delta = ev.clientY - gestureStartY;
        if (gestureMode == null) {
          if (Math.abs(delta) < DECIDE_PX) return;
          const canGrow = snapIdxRef.current < maxIdx;
          if (delta > 0 && gestureStartScrollTop <= 0) {
            gestureMode = "sheet";
            start(gestureStartY);
          } else if (delta < 0 && canGrow && gestureStartScrollTop <= 0) {
            gestureMode = "sheet";
            start(gestureStartY);
          } else {
            gestureMode = "content";
          }
        }
        if (gestureMode === "sheet") move(ev.clientY);
      };
      const onUp = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (gestureMode === "sheet") end(ev.clientY);
        gestureMode = null;
        gestureStartY = null;
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("mousedown", onMouseDown);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, snaps, maxIdx, closeThreshold, onOpenChange]);

  // 입력칸 포커스 시 키보드로 가려지지 않도록 자동 스크롤.
  // overlays-content 모드에선 layout viewport 가 변하지 않아 브라우저 기본
  // 스크롤이 작동 안 함. 키보드가 올라온 뒤(≈300ms) 포커스된 element 를
  // 스크롤 영역의 중앙으로 끌어옴.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement)
      ) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 300);
    };
    el.addEventListener("focusin", onFocusIn);
    return () => {
      if (timer) clearTimeout(timer);
      el.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  const currentSnap = snaps[snapIdx];
  // 시트 위치 = top. bottom 은 Sheet 베이스 style 의 `var(--kb-offset)` 유지
  // (키보드 올라오면 그 높이만큼 시트가 위로 밀려 입력칸 가려지지 않음).
  // height 로 고정하면 bottom 이 올라갔을 때 top 이 음수가 되어 상단이 잘림.
  const topPercent = (1 - currentSnap) * 100;
  const positionStyle: React.CSSProperties = {
    top: `calc(${topPercent}dvh + ${dragOffset}px)`,
    maxHeight: "100dvh",
    transition: dragging.current ? "none" : "top 180ms ease-out",
    // 상단 흰색 border 제거 — Sheet 의 data-[side=bottom]:border-t 오버라이드
    borderTopWidth: 0,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={`rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] flex flex-col ${className ?? ""}`}
        style={positionStyle}
        showBackButton={false}
        showCloseButton={false}
        initialFocus={false}
      >
        <SheetHeader className="px-4 pt-1 pb-1.5 gap-1 shrink-0">
          <div
            ref={handleRef}
            className="flex justify-center py-3 -my-2 touch-none cursor-grab active:cursor-grabbing"
            aria-label="드래그로 이동/닫기"
          >
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
          </div>
          {title && <SheetTitle className="text-sm">{title}</SheetTitle>}
        </SheetHeader>
        {scrollable ? (
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          >
            {children}
          </div>
        ) : (
          children
        )}
      </SheetContent>
    </Sheet>
  );
}

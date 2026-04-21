"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// 드래그 스냅 바텀시트.
// snapPoints = [0.5, 0.9] 면 50% / 90% 두 지점에 스냅.
// 최저 스냅에서 추가로 끌어내리면 닫힘(closeThreshold 추가 거리).
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
  // 스냅 지점은 오름차순 정렬. 배열 identity 가 매 렌더마다 바뀌면 effect 재구독되어
  // native listener 가 깜빡이므로 memoize.
  const snaps = useMemo(
    () => [...snapPoints].sort((a, b) => a - b),
    // 실제 값 변화만 감지: join 으로 안정화 (length/값 다 포함).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapPoints.join(",")]
  );
  const maxIdx = snaps.length - 1;
  const initialIdx = Math.max(0, Math.min(maxIdx, defaultSnapIndex ?? maxIdx));

  const [snapIdx, setSnapIdx] = useState(initialIdx);
  const [dragOffset, setDragOffset] = useState(0); // 현재 스냅 기준 추가 픽셀 오프셋(아래쪽 +)
  const dragging = useRef(false);
  const startYRef = useRef<number | null>(null);
  const startOffsetRef = useRef(0);
  const handleRef = useRef<HTMLDivElement | null>(null);

  // open 재설정
  useEffect(() => {
    if (open) {
      setSnapIdx(initialIdx);
      setDragOffset(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // snapIdx 도 ref 로 접근 — end() 시점에 최신 값 필요.
  const snapIdxRef = useRef(snapIdx);
  useEffect(() => { snapIdxRef.current = snapIdx; });

  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

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

      // 닫기 조건: 최저 스냅보다 closeThreshold 만큼 더 내려감
      const lowestHeightPx = snaps[0] * vh;
      if (currentHeightPx < lowestHeightPx - closeThreshold) {
        onOpenChange(false);
        setDragOffset(0);
        return;
      }

      // 가장 가까운 스냅 선택
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
  }, [snaps, closeThreshold, onOpenChange]);

  // 현재 시트 높이 = 스냅% - 드래그 오프셋 (오프셋은 px).
  // Tailwind 에서 동적 calc 로 계산.
  const currentSnap = snaps[snapIdx];
  const heightStyle: React.CSSProperties = {
    height: `calc(${currentSnap * 100}dvh - ${dragOffset}px)`,
    maxHeight: "100dvh",
    transition: dragging.current ? "none" : "height 180ms ease-out",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={`rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] flex flex-col ${className ?? ""}`}
        style={heightStyle}
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {children}
          </div>
        ) : (
          children
        )}
      </SheetContent>
    </Sheet>
  );
}

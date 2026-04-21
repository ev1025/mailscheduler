"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// 드래그 스냅 바텀시트.
// - 버튼 위에서도 드래그 허용. 짧은 터치(<8px)=click, 이상=drag.
// - native touchmove 리스너에 passive:false 로 preventDefault 가능 → 스크롤/클릭
//   합성 확실히 차단.

interface DraggableSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** snapPoints.length=1 이면 열림/닫힘만. 2 면 half/full 스냅. 기본 [0.5, 0.9]. */
  snapPoints?: number[];
  /** 초기 스냅. 0=half, 1=full. 기본 1. */
  defaultSnapIndex?: number;
  scrollable?: boolean;
  className?: string;
  children: React.ReactNode;
}

const SNAP_THRESHOLD = 60;
const MOVE_LOCK_PX = 8;

export default function DraggableSheet({
  open,
  onOpenChange,
  title,
  snapPoints = [0.5, 0.9],
  defaultSnapIndex = 1,
  scrollable = true,
  className,
  children,
}: DraggableSheetProps) {
  const isSingleSnap = snapPoints.length === 1;
  const halfVh = snapPoints[0] ?? 0.5;
  const fullVh = snapPoints[1] ?? snapPoints[0] ?? 0.9;
  const [snap, setSnap] = useState<"half" | "full">(
    defaultSnapIndex === 0 ? "half" : "full"
  );
  const [snapAnimating, setSnapAnimating] = useState(false);

  useEffect(() => {
    if (open) setSnap(defaultSnapIndex === 0 ? "half" : "full");
  }, [open, defaultSnapIndex]);

  useEffect(() => {
    if (snapAnimating) {
      const t = setTimeout(() => setSnapAnimating(false), 260);
      return () => clearTimeout(t);
    }
  }, [snapAnimating]);

  const changeSnap = (next: "half" | "full") => {
    setSnap(next);
    setSnapAnimating(true);
  };

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // 최신 state 접근용 ref
  const snapRef = useRef(snap);
  useEffect(() => { snapRef.current = snap; });
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => { onOpenChangeRef.current = onOpenChange; });

  useEffect(() => {
    if (!open) return;
    const el = wrapperRef.current;
    if (!el) return;

    let startY: number | null = null;
    let startSnap: "half" | "full" = "half";
    let scrollEl: HTMLElement | null = null;
    let canceled = false;
    let active = false;
    let clickBlocker: ((e: Event) => void) | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      // 편집 요소는 drag 스킵 (포커스/캐럿 이동 방해 X)
      if (target?.closest("input, textarea, select")) {
        startY = null;
        return;
      }
      startY = e.touches[0].clientY;
      startSnap = snapRef.current;
      canceled = false;
      active = false;
      scrollEl = target?.closest("[data-sheet-scroll]") as HTMLElement | null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY === null || canceled) return;
      const dy = e.touches[0].clientY - startY;

      // 스크롤 영역에서 정상 스크롤 허용 판단 (드래그 확정 전에만)
      if (!active) {
        if (scrollEl && dy > 0 && scrollEl.scrollTop > 0) {
          canceled = true;
          return;
        }
        if (startSnap === "full" && dy < 0 && scrollEl) {
          canceled = true;
          return;
        }
      }

      // 임계치 넘으면 drag 확정
      if (!active && Math.abs(dy) > MOVE_LOCK_PX) {
        active = true;
      }
      if (active && e.cancelable) {
        e.preventDefault(); // 스크롤/클릭 합성 차단
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (startY === null || canceled) {
        startY = null;
        active = false;
        canceled = false;
        scrollEl = null;
        return;
      }
      const wasActive = active;
      const dy = (e.changedTouches[0]?.clientY ?? startY) - startY;
      startY = null;
      active = false;
      canceled = false;
      scrollEl = null;

      // 드래그였으면 터치 후 합성되는 click 을 1회 차단
      if (wasActive) {
        clickBlocker = (ev: Event) => {
          ev.stopPropagation();
          ev.preventDefault();
          if (clickBlocker) {
            el.removeEventListener("click", clickBlocker, true);
            clickBlocker = null;
          }
        };
        el.addEventListener("click", clickBlocker, true);
        // 백업: 300ms 안에 click 안 오면 해제
        setTimeout(() => {
          if (clickBlocker) {
            el.removeEventListener("click", clickBlocker, true);
            clickBlocker = null;
          }
        }, 300);
      }

      const T = SNAP_THRESHOLD;
      if (isSingleSnap) {
        if (dy > T * 2) onOpenChangeRef.current(false);
        return;
      }
      if (startSnap === "half") {
        if (dy < -T) changeSnap("full");
        else if (dy > T) onOpenChangeRef.current(false);
      } else {
        if (dy > T * 3) onOpenChangeRef.current(false);
        else if (dy > T) changeSnap("half");
      }
    };

    // passive:false — onTouchMove 에서 preventDefault 가 실제 작동하도록
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      if (clickBlocker) el.removeEventListener("click", clickBlocker, true);
    };
  }, [open, isSingleSnap]);

  const height = snap === "full" ? `${fullVh * 100}dvh` : `${halfVh * 100}dvh`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={`rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] overflow-hidden ${
          snapAnimating ? "transition-[height] duration-[250ms] ease-out" : ""
        } ${className ?? ""}`}
        style={{ height, borderTopWidth: 0 }}
        showBackButton={false}
        showCloseButton={false}
        initialFocus={false}
        finalFocus={false}
      >
        <div ref={wrapperRef} className="flex flex-col h-full min-h-0">
          {/* 핸들바 */}
          <div className="flex justify-center py-2 shrink-0 touch-none" aria-label="드래그로 이동/닫기">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
          </div>
          {title && (
            <SheetTitle className="text-sm px-4 pb-1.5 shrink-0">{title}</SheetTitle>
          )}
          {scrollable ? (
            <div
              data-sheet-scroll
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
            >
              {children}
            </div>
          ) : (
            children
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

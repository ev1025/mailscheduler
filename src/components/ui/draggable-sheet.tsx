"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// 드래그 스냅 바텀시트 — React onTouch 기반 (TagInput 과 동일한 검증된 패턴).
// - 핸들바·빈 영역·버튼 어디서든 드래그로 시트 이동/닫기
// - 짧은 터치(<8px)는 click 으로 버튼 정상 동작
// - 드래그 확정 시 touchend 이후 합성되는 click 1회 차단
// - input/textarea/select 편집 요소는 제외 (포커스/캐럿 방해 X)

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

  // 드래그 상태 — ref 로 touch 이벤트 간 유지
  const dragStartY = useRef<number | null>(null);
  const dragStartSnap = useRef<"half" | "full">("half");
  const dragScrollEl = useRef<HTMLElement | null>(null);
  const dragCanceled = useRef(false);
  const dragActive = useRef(false); // 실제 drag 로 판정 (>MOVE_LOCK_PX)

  const onTouchStart = (e: React.TouchEvent) => {
    const target = (e.target as HTMLElement) || null;
    // 편집 요소만 제외 — button 포함 나머지는 drag 허용
    if (target?.closest("input, textarea, select")) {
      dragStartY.current = null;
      return;
    }
    dragStartY.current = e.touches[0].clientY;
    dragStartSnap.current = snap;
    dragCanceled.current = false;
    dragActive.current = false;
    dragScrollEl.current = target?.closest("[data-sheet-scroll]") as HTMLElement | null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null || dragCanceled.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;

    // 스크롤 vs 드래그 우선순위 (drag 확정 전에만 판단):
    //  - full 상태: 컨텐츠 스크롤이 우선. scrollTop>0 에서 아래로 드래그 = 스크롤,
    //    scrollTop=0 에서만 아래로 드래그 시 시트 내림. 위로 드래그는 스크롤.
    //  - half 상태: 무조건 시트 드래그 (컨텐츠 스크롤 무시, 간결한 컴팩트 UX)
    if (!dragActive.current && dragStartSnap.current === "full" && dragScrollEl.current) {
      const scrollTop = dragScrollEl.current.scrollTop;
      if (dy > 0 && scrollTop > 0) {
        dragCanceled.current = true;
        return;
      }
      if (dy < 0) {
        dragCanceled.current = true;
        return;
      }
    }

    // 8px 넘으면 drag 로 확정 (이후 touchend 에서 합성 click 차단)
    if (!dragActive.current && Math.abs(dy) > MOVE_LOCK_PX) {
      dragActive.current = true;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const canceled = dragCanceled.current;
    const wasActive = dragActive.current;
    dragCanceled.current = false;
    dragActive.current = false;
    dragScrollEl.current = null;
    if (dragStartY.current === null || canceled) {
      dragStartY.current = null;
      return;
    }
    const dy = (e.changedTouches[0]?.clientY ?? dragStartY.current) - dragStartY.current;
    dragStartY.current = null;

    const T = SNAP_THRESHOLD;
    let didSomething = false;
    if (isSingleSnap) {
      if (dy > T * 2) {
        onOpenChange(false);
        didSomething = true;
      }
    } else if (dragStartSnap.current === "half") {
      if (dy < -T) { changeSnap("full"); didSomething = true; }
      else if (dy > T) { onOpenChange(false); didSomething = true; }
    } else {
      if (dy > T * 3) { onOpenChange(false); didSomething = true; }
      else if (dy > T) { changeSnap("half"); didSomething = true; }
    }

    // drag 확정됐거나 실제 snap 변화 있었으면 touchend 뒤 합성되는 click 1회 차단
    if (wasActive || didSomething) {
      setClickBlock(true);
    }
  };

  // click 차단 플래그 — touch 드래그 직후 합성되는 click 을 1회 무시
  const [clickBlock, setClickBlock] = useState(false);
  useEffect(() => {
    if (!clickBlock) return;
    const timer = setTimeout(() => setClickBlock(false), 350);
    return () => clearTimeout(timer);
  }, [clickBlock]);

  const onClickCapture = (e: React.MouseEvent) => {
    if (clickBlock) {
      e.stopPropagation();
      e.preventDefault();
      setClickBlock(false);
    }
  };

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
        <div
          className="flex flex-col h-full min-h-0"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          onClickCapture={onClickCapture}
        >
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

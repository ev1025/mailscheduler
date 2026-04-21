"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// 드래그 스냅 바텀시트 — TagInput 과 완전 동일한 구조/패턴.
// 핵심: onTouch* 핸들러는 SheetContent 가 아닌 내부 wrapper div 에.
// (Base UI Popup 은 일부 pointer 이벤트를 forward 하지 않아 동작 안 함)

interface DraggableSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** 2개 스냅만 사용 (첫=half, 두번째=full). 기본 [0.5, 0.9]. */
  snapPoints?: number[];
  /** 초기 스냅. 0=half, 1=full. 기본 1. */
  defaultSnapIndex?: number;
  scrollable?: boolean;
  className?: string;
  children: React.ReactNode;
}

const SNAP_THRESHOLD = 60;

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
  // snapPoints 길이 1 = 단일 스냅(열림/닫힘만). 2 = half/full 두 지점.
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

  // ── 드래그 (TagInput 과 동일) ─────────────────────────
  const dragStartY = useRef<number | null>(null);
  const dragStartSnap = useRef<"half" | "full">("half");
  const dragScrollEl = useRef<HTMLElement | null>(null);
  const dragCanceled = useRef(false);

  const onDragStart = (e: React.TouchEvent | React.PointerEvent) => {
    const target = (e.target as HTMLElement) || null;
    if (target?.closest("input, textarea, button, select, [role=button]")) {
      dragStartY.current = null;
      return;
    }
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = y;
    dragStartSnap.current = snap;
    dragCanceled.current = false;
    dragScrollEl.current = target?.closest("[data-sheet-scroll]") as HTMLElement | null;
  };

  const onDragMove = (e: React.TouchEvent | React.PointerEvent) => {
    if (dragStartY.current === null || dragCanceled.current) return;
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    const dy = y - dragStartY.current;
    if (dragScrollEl.current && dy > 0 && dragScrollEl.current.scrollTop > 0) {
      dragCanceled.current = true;
      return;
    }
    if (dragStartSnap.current === "full" && dy < 0 && dragScrollEl.current) {
      dragCanceled.current = true;
      return;
    }
  };

  const onDragEnd = (e: React.TouchEvent | React.PointerEvent) => {
    const canceled = dragCanceled.current;
    dragCanceled.current = false;
    dragScrollEl.current = null;
    if (dragStartY.current === null || canceled) {
      dragStartY.current = null;
      return;
    }
    const y =
      "changedTouches" in e ? e.changedTouches[0].clientY : e.clientY;
    const dy = y - dragStartY.current;
    dragStartY.current = null;
    const T = SNAP_THRESHOLD;
    // 단일 스냅 모드: 열림 ↔ 닫힘만. 드래그 2T 이상 내리면 닫힘.
    if (isSingleSnap) {
      if (dy > T * 2) onOpenChange(false);
      return;
    }
    if (dragStartSnap.current === "half") {
      if (dy < -T) changeSnap("full");
      else if (dy > T) onOpenChange(false);
    } else {
      if (dy > T * 3) onOpenChange(false);
      else if (dy > T) changeSnap("half");
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
        {/* 드래그 wrapper — onTouch 핸들러는 여기에 붙음
            (SheetContent 에 직접 붙이면 Base UI Popup 이 onPointer 를 일부 filter) */}
        <div
          className="flex flex-col h-full min-h-0"
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
          onTouchCancel={onDragEnd}
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

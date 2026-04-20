"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// 드래그로 닫히는 바텀시트 공용 컴포넌트.
// 기존에 plan-task-sheet · plan-transport-picker 에 각각 직접 구현되던
// 드래그 로직을 한 곳으로 통합 + 실제 작동하는 native touch 이벤트로 수정.
//
// React onPointer 핸들러가 일부 iOS/Android 환경에서 Base UI Dialog 의
// 이벤트 위임과 충돌해 pointermove 가 도달하지 않던 문제 → native
// touchstart/move/end + mousedown/move/up 을 직접 바인딩해 회피.

interface DraggableSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** 닫히는 최소 드래그 거리 (px). 기본 120 */
  closeThreshold?: number;
  /** 시트 내부 콘텐츠의 최대 높이. 기본 "90dvh" */
  maxHeight?: string;
  /** children 을 스크롤 가능한 영역으로 감쌀지. 기본 true */
  scrollable?: boolean;
  className?: string;
  children: React.ReactNode;
}

export default function DraggableSheet({
  open,
  onOpenChange,
  title,
  closeThreshold = 120,
  maxHeight = "90dvh",
  scrollable = true,
  className,
  children,
}: DraggableSheetProps) {
  const [dragY, setDragY] = useState(0);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);

  // native 이벤트 바인딩 — React pointer 이벤트가 일부 환경에서 작동 안 함.
  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    const start = (clientY: number) => {
      startYRef.current = clientY;
    };
    const move = (clientY: number) => {
      if (startYRef.current == null) return;
      const delta = clientY - startYRef.current;
      setDragY(Math.max(0, delta));
    };
    const end = (clientY: number) => {
      const startY = startYRef.current;
      startYRef.current = null;
      if (startY == null) {
        setDragY(0);
        return;
      }
      const delta = clientY - startY;
      if (delta > closeThreshold) onOpenChange(false);
      setDragY(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      start(e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current == null) return;
      e.preventDefault(); // 시트 뒤 페이지 스크롤 방지
      move(e.touches[0].clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (startYRef.current == null) return;
      end(e.changedTouches[0].clientY);
    };

    const onMouseDown = (e: MouseEvent) => {
      start(e.clientY);
      const onMouseMoveWin = (ev: MouseEvent) => move(ev.clientY);
      const onMouseUpWin = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", onMouseMoveWin);
        window.removeEventListener("mouseup", onMouseUpWin);
        end(ev.clientY);
      };
      window.addEventListener("mousemove", onMouseMoveWin);
      window.addEventListener("mouseup", onMouseUpWin);
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
  }, [closeThreshold, onOpenChange]);

  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  const contentStyle: React.CSSProperties = {
    maxHeight,
    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
    transition: startYRef.current == null ? "transform 150ms ease-out" : "none",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={`rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] flex flex-col ${className ?? ""}`}
        style={contentStyle}
        showBackButton={false}
        showCloseButton={false}
        initialFocus={false}
      >
        <SheetHeader className="px-4 pt-1 pb-1.5 gap-1 shrink-0">
          {/* 드래그 핸들 — 터치 타겟을 넓게 잡기 위해 바깥 div 에 py-3 */}
          <div
            ref={handleRef}
            className="flex justify-center py-3 -my-2 touch-none cursor-grab active:cursor-grabbing"
            aria-label="드래그로 닫기"
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

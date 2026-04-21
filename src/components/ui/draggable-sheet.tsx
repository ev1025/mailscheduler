"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// 드래그 스냅 바텀시트.
// TagInput 바텀시트와 동일한 React 이벤트 기반 드래그 패턴 사용 — 앱 전체 일관.
//
// 사용 원칙:
//  - SheetContent 자체에 React onPointerDown/Move/Up 등록 → 시트 어디서든 드래그
//  - 입력요소(input/textarea/button) 위에선 드래그 시작 안 함
//  - 스크롤 영역(data-sheet-scroll) 안에서 스크롤이 맨 위 아닌 상태로 아래로 끌면
//    드래그 취소 → 스크롤 우선
//  - 최대 스냅에서 위로 밀면 스크롤 우선
//  - 2개 스냅 기본: [0.5, 0.9] → "half" / "full" 토글
//  - 최하 스냅에서 추가로 아래로 크게 끌면 닫힘

interface DraggableSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** 스냅 지점 (뷰포트 높이 비율). 2개만 사용 (첫=half, 두번째=full). 기본 [0.5, 0.9]. */
  snapPoints?: number[];
  /** 시트 열릴 때 초기 스냅. 0=half, 1=full. 기본 1. */
  defaultSnapIndex?: number;
  /** children 을 스크롤 가능 영역으로 감쌀지. 기본 true */
  scrollable?: boolean;
  className?: string;
  children: React.ReactNode;
}

// 드래그 임계치 (px)
const SNAP_THRESHOLD = 60;
const CLOSE_EXTRA = 3; // half 에서 closeThreshold = T × 3

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
  // 2개 스냅만 사용 — 부족하면 안전한 기본값으로 보정
  const halfVh = snapPoints[0] ?? 0.5;
  const fullVh = snapPoints[1] ?? snapPoints[0] ?? 0.9;
  const [snap, setSnap] = useState<"half" | "full">(
    defaultSnapIndex === 0 ? "half" : "full"
  );
  const [snapAnimating, setSnapAnimating] = useState(false);

  // 열릴 때마다 초기 스냅으로 재설정
  useEffect(() => {
    if (open) setSnap(defaultSnapIndex === 0 ? "half" : "full");
  }, [open, defaultSnapIndex]);

  // 스냅 전환 시 애니메이션 활성 → 끝나면 비활성 (드래그 중 전환 애니메이션 없도록)
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

  // ── 드래그 로직 (TagInput 과 동일 패턴) ─────────────────────────
  const dragStartY = useRef<number | null>(null);
  const dragStartSnap = useRef<"half" | "full">("half");
  const dragScrollEl = useRef<HTMLElement | null>(null);
  const dragCanceled = useRef(false);

  const onDragStart = (e: React.PointerEvent) => {
    const target = (e.target as HTMLElement) || null;
    // 입력 요소/버튼 위에서는 드래그 시작 안 함
    if (target?.closest("input, textarea, button, select, [role=button]")) {
      dragStartY.current = null;
      return;
    }
    dragStartY.current = e.clientY;
    dragStartSnap.current = snap;
    dragCanceled.current = false;
    dragScrollEl.current = target?.closest("[data-sheet-scroll]") as HTMLElement | null;
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null || dragCanceled.current) return;
    const dy = e.clientY - dragStartY.current;
    // 스크롤 영역에서 아래로 끌고 있는데 스크롤이 위가 아니면 → 스크롤 우선
    if (dragScrollEl.current && dy > 0 && dragScrollEl.current.scrollTop > 0) {
      dragCanceled.current = true;
      return;
    }
    // full 상태에서 위로는 더 이상 올릴 공간 없음 → 스크롤 허용
    if (dragStartSnap.current === "full" && dy < 0 && dragScrollEl.current) {
      dragCanceled.current = true;
      return;
    }
  };

  const onDragEnd = (e: React.PointerEvent) => {
    const canceled = dragCanceled.current;
    dragCanceled.current = false;
    dragScrollEl.current = null;
    if (dragStartY.current === null || canceled) {
      dragStartY.current = null;
      return;
    }
    const dy = e.clientY - dragStartY.current;
    dragStartY.current = null;
    const T = SNAP_THRESHOLD;
    if (dragStartSnap.current === "half") {
      if (dy < -T) changeSnap("full");
      else if (dy > T) onOpenChange(false);
    } else {
      // full 상태
      if (dy > T * CLOSE_EXTRA) onOpenChange(false);
      else if (dy > T) changeSnap("half");
    }
  };

  const height = snap === "full" ? `${fullVh * 100}dvh` : `${halfVh * 100}dvh`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={`rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] overflow-hidden flex flex-col touch-pan-y ${
          snapAnimating ? "transition-[height] duration-[250ms] ease-out" : ""
        } ${className ?? ""}`}
        style={{ height, borderTopWidth: 0 }}
        showBackButton={false}
        showCloseButton={false}
        initialFocus={false}
        finalFocus={false}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        {/* 핸들바 — 시각적 인디케이터 (실제 드래그는 SheetContent 전체에서 가능) */}
        <div className="flex justify-center py-2 shrink-0" aria-label="드래그로 이동/닫기">
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
      </SheetContent>
    </Sheet>
  );
}

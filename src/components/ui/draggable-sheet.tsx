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

  // 시트 높이 기준 — 키보드가 올라와도 축소되지 않도록 관찰된 최대 높이 유지.
  // 시트가 키보드 올라간 상태에서 열리면 작은 viewport 가 잡혀 20% 크기로 보이던 버그 방지.
  const [baseHeight, setBaseHeight] = useState<number | null>(null);
  // 현재 visualViewport 높이 — 키보드 상태 추적용. full snap 에서 상한 조정.
  const [currentVh, setCurrentVh] = useState<number | null>(null);
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const capture = () => {
      const vv = window.visualViewport?.height;
      const ih = window.innerHeight;
      const nowVh = vv ?? ih;
      setCurrentVh(nowVh);
      // baseHeight 는 관찰된 최대값 유지(키보드 내려갔을 때의 큰 viewport).
      const h = Math.max(ih, vv ?? 0);
      setBaseHeight((prev) => (prev == null ? h : Math.max(prev, h)));
    };
    capture();
    window.visualViewport?.addEventListener("resize", capture);
    window.addEventListener("orientationchange", capture);
    return () => {
      window.visualViewport?.removeEventListener("resize", capture);
      window.removeEventListener("orientationchange", capture);
    };
  }, [open]);
  // 회전 시엔 최대값 리셋이 필요해 open 닫을 때 초기화.
  useEffect(() => {
    if (!open) { setBaseHeight(null); setCurrentVh(null); }
  }, [open]);

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
    // 드래그 시작 = "화면을 넓게 보겠다" 의도 → 키보드 즉시 내림.
    // resizes-content 환경에서 키보드가 내려가면 viewport 가 원래대로 커지는데
    // 드래그 도중 이벤트 좌표계가 갑자기 바뀌면 snap 계산이 꼬이므로
    // 드래그 시작 시점에 미리 내려두는 게 안전.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    dragStartY.current = e.touches[0].clientY;
    dragStartSnap.current = snap;
    dragCanceled.current = false;
    dragActive.current = false;
    dragScrollEl.current = target?.closest("[data-sheet-scroll]") as HTMLElement | null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const y = e.touches[0].clientY;

    // 스크롤 vs 드래그 우선순위 — 시트 높이 기준:
    //  - 0.85(85%) 이상 → 컨텐츠 스크롤 우선. scrollTop>0 또는 위로 스와이프는
    //    네이티브 스크롤 처리, dragStartY 를 현재 위치로 재anchor.
    //  - 0.85 미만 → 스크롤 무시, 항상 시트 드래그
    const currentVh = dragStartSnap.current === "full" ? fullVh : halfVh;
    const scrollPriority = currentVh >= 0.85;
    if (scrollPriority && dragScrollEl.current && !dragActive.current) {
      const scrollTop = dragScrollEl.current.scrollTop;
      const dy = y - dragStartY.current;
      // (a) scrollTop>0: 컨텐츠 스크롤 가능 → 네이티브 스크롤 처리, anchor 재설정
      // (b) scrollTop=0 이어도 위로 스와이프(dy<0): 컨텐츠 스크롤 다운 가능 → anchor 재설정
      if (scrollTop > 0 || dy < 0) {
        dragStartY.current = y;
        return;
      }
      // scrollTop=0 + 아래로 스와이프: 이제부터 시트 드래그로 간주
    }

    const dy = y - dragStartY.current;
    // 8px 넘으면 drag 로 확정 (touchend 에서 합성 click 차단)
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

  // 시트 높이: baseHeight * 비율. 단 full snap 에서 키보드가 올라와 viewport 가
  // 축소되면 상한을 visualViewport 로 제한 → 입력창이 뷰포트 밖으로 밀려 안 보이는
  // 현상(사용자가 "90% 키보드 가림방지로 입력창 안 보임" 이라 함) 방지.
  const height = (() => {
    if (baseHeight == null) {
      return snap === "full" ? `${fullVh * 100}dvh` : `${halfVh * 100}dvh`;
    }
    const ratio = snap === "full" ? fullVh : halfVh;
    const plannedPx = Math.round(ratio * baseHeight);
    if (snap === "full" && currentVh != null && currentVh < plannedPx) {
      return `${Math.round(currentVh)}px`;
    }
    return `${plannedPx}px`;
  })();

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

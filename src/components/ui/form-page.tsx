"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// 공용 폼 페이지 팝업.
//  - 모바일: 전체화면 (h = 100dvh - kb-offset)
//  - 데스크탑: 중앙 모달 (max-w-lg, max-h 85dvh)
//  - 상단 ← 뒤로가기 + 제목
//  - 스크롤 가능한 바디 (포커스 시 입력칸 자동 스크롤)
//  - 하단 고정 footer: 취소 / 저장 (또는 커스텀 action)
//
// event-form / plan-task-sheet / travel-form / 기타 추가·수정 폼이 이걸 공통으로 사용.
// 전체화면 팝업 + 키보드 오프셋 + 취소/저장 패턴을 3~4곳에서 중복하던 것 통합.

interface FormPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** 저장 버튼 라벨. 기본 "저장" */
  submitLabel?: string;
  /** 취소 버튼 라벨. 기본 "취소" */
  cancelLabel?: string;
  /** 저장 버튼 비활성 여부 */
  submitDisabled?: boolean;
  /** 저장 진행 중 여부 (버튼에 "저장 중…" 표시) */
  saving?: boolean;
  /** 저장 핸들러 */
  onSubmit: () => void | Promise<void>;
  /** 취소 핸들러. 생략 시 onOpenChange(false) */
  onCancel?: () => void;
  /** 뒤로가기 핸들러. 생략 시 onCancel 동작 */
  onBack?: () => void;
  /** 데스크탑 max-w 클래스 (기본 md:!max-w-lg) */
  desktopMaxWidth?: string;
  /** 헤더 우측 추가 컨텐츠 (예: 날씨 아이콘) */
  headerExtra?: React.ReactNode;
  /** 하단 footer 왼쪽 slot (예: 삭제 버튼) */
  footerStart?: React.ReactNode;
  children: React.ReactNode;
}

export default function FormPage({
  open,
  onOpenChange,
  title,
  submitLabel = "저장",
  cancelLabel = "취소",
  submitDisabled = false,
  saving = false,
  onSubmit,
  onCancel,
  onBack,
  desktopMaxWidth = "md:!max-w-lg",
  headerExtra,
  footerStart,
  children,
}: FormPageProps) {
  const handleCancel = onCancel ?? (() => onOpenChange(false));
  const handleBack = onBack ?? handleCancel;

  // 키보드 대응 — 입력칸 포커스 시 visualViewport 기준으로 키보드 위에 오도록 스크롤.
  // overlays-content 모드에서 브라우저 기본 스크롤이 layout viewport 기준이라
  // 키보드에 가려지는 입력칸을 못 올림 → 수동 처리 필수.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    // 입력칸이 visualViewport 안에 보이도록 스크롤
    const bringIntoView = (target: HTMLElement) => {
      const vv = window.visualViewport;
      const visibleTop = vv ? vv.offsetTop : 0;
      const visibleBottom = vv
        ? vv.offsetTop + vv.height
        : window.innerHeight;
      const rect = target.getBoundingClientRect();
      // 입력칸 하단이 visual viewport 하단에서 최소 40px 이상 위에 있도록
      const safeBottom = visibleBottom - 40;
      if (rect.bottom > safeBottom) {
        const delta = rect.bottom - safeBottom;
        scrollEl.scrollBy({ top: delta, behavior: "smooth" });
        return;
      }
      // 위로 가려진 경우 (타이틀 아래로 숨음)
      const safeTop = visibleTop + 20;
      if (rect.top < safeTop) {
        const delta = rect.top - safeTop;
        scrollEl.scrollBy({ top: delta, behavior: "smooth" });
      }
    };

    const scheduleBring = (target: HTMLElement) => {
      if (timer) clearTimeout(timer);
      // 키보드 슬라이드 애니메이션(≈250ms) + visualViewport resize 이벤트 기다림
      timer = setTimeout(() => bringIntoView(target), 350);
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement)
      ) return;
      scheduleBring(target);
    };

    // visualViewport 가 변하면(키보드가 뒤늦게 올라오거나 내려가면) 활성 입력칸 재조정
    const onViewportResize = () => {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement
      ) {
        if (scrollEl.contains(active)) bringIntoView(active);
      }
    };

    scrollEl.addEventListener("focusin", onFocusIn);
    window.visualViewport?.addEventListener("resize", onViewportResize);
    return () => {
      if (timer) clearTimeout(timer);
      scrollEl.removeEventListener("focusin", onFocusIn);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showBackButton
        onBack={handleBack}
        initialFocus={false}
        style={{ height: "calc(100dvh - var(--kb-offset, 0px))" }}
        className={`
          !max-w-none !w-full !top-0 !left-0
          !translate-x-0 !translate-y-0 !rounded-none !p-0
          !gap-0 flex flex-col
          ${desktopMaxWidth} md:!w-auto md:!max-h-[85dvh]
          md:!top-1/2 md:!left-1/2 md:!-translate-x-1/2 md:!-translate-y-1/2
          md:!rounded-xl
        `}
      >
        <DialogHeader className="px-3 pt-3 pb-2 border-b shrink-0">
          {headerExtra ? (
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-base">{title}</DialogTitle>
              {headerExtra}
            </div>
          ) : (
            <DialogTitle className="text-base">{title}</DialogTitle>
          )}
        </DialogHeader>
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3"
        >
          {children}
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t shrink-0 bg-background">
          <div>{footerStart}</div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={saving}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => { void onSubmit(); }}
              disabled={saving || submitDisabled}
            >
              {saving ? "저장 중…" : submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

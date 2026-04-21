"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/use-media-query";

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

  const isDesktop = useMediaQuery("(min-width: 768px)");

  // 모바일 DialogContent 실제 높이 — visualViewport.height 직접 사용.
  // dvh / window.innerHeight 는 브라우저(특히 Android Chrome)마다 키보드 처리가
  // 달라 신뢰 어려움. visualViewport 는 항상 "현재 보이는 영역" 을 반환.
  const [visualHeight, setVisualHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    if (isDesktop) {
      setVisualHeight(null);
      return;
    }
    const vv = window.visualViewport;
    const update = () => {
      setVisualHeight(vv ? vv.height : window.innerHeight);
    };
    update();
    vv?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, [open, isDesktop]);

  // 키보드 대응 — 입력칸 포커스 시 스크롤.
  // 전략: scroll-padding-bottom + padding-bottom (CSS, 위 style) 이 주로 처리.
  //  1. 컨테이너의 padding-bottom = kb-offset + 여분 → textarea 아래 스크롤 여유 확보
  //  2. scroll-padding-bottom = kb-offset + 여분 → scrollIntoView 시 target 이 이
  //     영역 위에 오도록 브라우저가 보장
  //  3. focusin 에서 scrollIntoView({block:end}) 명시 호출
  //  4. visualViewport resize 에서도 재호출 (키보드가 뒤늦게 올라오는 케이스)
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const bringIntoView = (target: HTMLElement) => {
      target.scrollIntoView({ block: "end", behavior: "smooth" });
      // visualViewport 상 input 이 여전히 가려져 있으면 scrollBy 로 추가 보정
      requestAnimationFrame(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const rect = target.getBoundingClientRect();
        const visibleBottom = vv.offsetTop + vv.height;
        const safeBottom = visibleBottom - 40;
        if (rect.bottom > safeBottom) {
          scrollEl.scrollBy({ top: rect.bottom - safeBottom, behavior: "smooth" });
        }
      });
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement)
      ) return;
      if (timer) clearTimeout(timer);
      // 즉시 한 번 + 350ms 후 한 번 (키보드 슬라이드 완료 후)
      bringIntoView(target);
      timer = setTimeout(() => bringIntoView(target), 350);
    };

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
        // 모바일 높이는 visualViewport 기준으로 JS 직접 세팅.
        // 키보드 올라오면 visualViewport.height 가 줄어들고 DialogContent 도 같이
        // 줄어 footer 와 마지막 입력칸이 키보드에 가려지지 않음.
        // 데스크탑은 미디어쿼리로 이 inline height 를 덮어쓰기 어려우므로 CSS 로 처리.
        style={
          !isDesktop && visualHeight != null
            ? { height: `${visualHeight}px` }
            : undefined
        }
        className={`
          !max-w-none !w-full !h-[100dvh] !top-0 !left-0
          !translate-x-0 !translate-y-0 !rounded-none !p-0
          !gap-0 flex flex-col
          ${desktopMaxWidth} md:!w-auto md:!max-h-[85dvh] md:!h-auto
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
        {/* 스크롤 컨테이너. DialogContent 가 이미 kb-offset 만큼 줄어든 상태라
            내부는 padding-bottom=2rem (단순 여백) + scroll-padding-bottom=3rem
            (block:end scrollIntoView 시 target 이 footer 바로 붙어 바닥에 안 붙게)
            만 있으면 충분. */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-8"
          style={{ scrollPaddingBottom: "3rem" }}
          // 빈 영역 탭 시 포커스된 input/textarea blur → 키보드 자동 내림.
          // 진짜 빈 영역에서만 동작하도록 target=currentTarget 인 경우만.
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              const active = document.activeElement;
              if (
                active instanceof HTMLInputElement ||
                active instanceof HTMLTextAreaElement
              ) {
                active.blur();
              }
            }
          }}
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

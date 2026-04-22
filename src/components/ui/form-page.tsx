"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/use-media-query";
import { useDialogStackEntry } from "@/lib/dialog-stack";

// 공용 폼 페이지 — Base UI Dialog 없는 버전.
// 이유: position:fixed Dialog + 포털 내부에선 모바일 Chrome 의 input focus 자동
// 스크롤이 깨져서 키보드 가림 현상 발생. 일반 DOM 요소 + position:fixed
// 직접 제어 + body overflow hidden 만 하면 브라우저 기본 동작이 잘 작동함.
//
// - 모바일: 전체 화면 오버레이 (fixed inset-0)
// - 데스크탑: 중앙 모달 (max-w-lg)
// - 상단 ← 뒤로가기 + 제목
// - 하단 취소/저장 footer
// - open 동안 body overflow hidden → 배경 스크롤 방지

interface FormPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  submitDisabled?: boolean;
  saving?: boolean;
  onSubmit: () => void | Promise<void>;
  onCancel?: () => void;
  onBack?: () => void;
  /** 데스크탑 max-w 클래스 (기본 md:max-w-lg) */
  desktopMaxWidth?: string;
  headerExtra?: React.ReactNode;
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
  desktopMaxWidth = "md:max-w-lg",
  headerExtra,
  footerStart,
  children,
}: FormPageProps) {
  const handleCancel = onCancel ?? (() => onOpenChange(false));
  const handleBack = onBack ?? handleCancel;

  const isDesktop = useMediaQuery("(min-width: 768px)");

  // 뒤로가기 스택 연결 (하드웨어 뒤로가기 처리)
  useDialogStackEntry(open, onOpenChange);

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleCancel]);

  // body overflow 잠금 — 배경 스크롤 차단
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 포커스 진입 시 scrollIntoView — 일반 DOM 요소 안에선 브라우저 기본 스크롤이
  // 대부분 잘 작동하지만 혹시 모를 edge case 대응
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    setMounted(true);
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement)
      ) return;
      // 키보드 슬라이드 대기 후 한 번 더 보정
      setTimeout(() => {
        try {
          target.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch {
          /* ignore */
        }
      }, 300);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex md:items-center md:justify-center md:bg-black/50 md:backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      // 데스크탑: 배경 클릭 시 닫기. 모바일: 배경 없음(전체화면)
      onClick={(e) => {
        if (!isDesktop) return;
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        className={`
          bg-background flex flex-col
          w-full h-[100dvh]
          ${desktopMaxWidth}
          md:h-auto md:max-h-[85dvh] md:w-auto md:rounded-xl md:shadow-xl md:ring-1 md:ring-foreground/10
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더: ← 뒤로가기 + 제목 + headerExtra */}
        <div className="flex items-center gap-2 border-b px-3 py-2.5 shrink-0">
          <button
            type="button"
            onClick={handleBack}
            aria-label="뒤로"
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 -ml-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="font-heading text-base font-medium text-foreground flex-1 min-w-0 truncate">
            {title}
          </h2>
          {headerExtra}
        </div>

        {/* 본문: flex-1 overflow-y-auto + 빈 영역 탭 시 blur.
            pt-1 로 헤더(드래그바·타이틀) 와 컨텐츠 첫 요소 간격을 기존 pt-3(12px) 대비
            약 1/3(4px) 수준으로 축소. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 pt-1 pb-3"
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
          {/* Bottom bumper — 키보드/안전영역 아래 여유공간 */}
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
          <div className="h-4" />
        </div>

        {/* 하단 footer */}
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
      </div>

      {/* 초기 mount 트리거 용 — 리렌더 없이 mounted flag 유지 */}
      {!mounted && <span className="hidden" aria-hidden="true" />}
    </div>
  );
}

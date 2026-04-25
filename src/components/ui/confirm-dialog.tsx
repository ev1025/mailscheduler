"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  /** popup className override — FormPage(z-[70]) 내부에서 띄울 때 z-[80] 으로 올려야
   *  backdrop 위에 보임. 기본값은 그대로 z-50. */
  contentClassName?: string;
}

/**
 * 네이티브 `window.confirm()` 대체. 모바일·데스크톱 공통 디자인 토큰:
 * - 모바일: 좌우 1rem 인셋. 버튼은 풀너비 2분할(취소/확인).
 * - 데스크톱: max-w-sm. 우측 정렬 + 자동 너비.
 * - title 17px / description 14px leading-relaxed + break-keep(한국어 단어 단위 줄바꿈).
 * - 버튼 tap target 44px (h-11) — iOS HIG 권장.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title = "확인",
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  destructive = false,
  onConfirm,
  contentClassName,
}: Props) {
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // 모바일에서 좌우 인셋을 더 줘서 답답함 완화 (max-w-[20rem]).
        // 데스크톱은 sm:max-w-sm(384px) 그대로.
        className={cn(
          "max-w-[20rem] sm:max-w-sm gap-3.5 p-5 sm:p-6",
          contentClassName
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-base sm:text-[17px] font-semibold leading-tight break-keep">
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-[13px] sm:text-sm text-muted-foreground leading-relaxed break-keep whitespace-pre-wrap">
          {description}
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="h-11 sm:h-9 sm:min-w-[80px]"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={submit}
            disabled={busy}
            className="h-11 sm:h-9 sm:min-w-[80px]"
          >
            {busy ? "처리 중…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

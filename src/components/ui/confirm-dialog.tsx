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
 * 네이티브 `window.confirm()` 대체. 브라우저 "URL 내용:" 프리픽스 제거.
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
      <DialogContent className={cn("sm:max-w-sm", contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {description}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button
              size="sm"
              variant={destructive ? "destructive" : "default"}
              onClick={submit}
              disabled={busy}
            >
              {busy ? "처리 중..." : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void | Promise<void>;
}

/**
 * 네이티브 `window.prompt()` 대체. 브라우저의 "URL 내용:" 안내가 붙는 UX를 제거.
 */
export default function PromptDialog({
  open,
  onOpenChange,
  title,
  placeholder,
  defaultValue = "",
  confirmLabel = "확인",
  onConfirm,
}: Props) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const submit = async () => {
    const v = value.trim();
    if (!v) return;
    await onConfirm(v);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              // 한글 IME 조합 중 Enter 는 조합 확정용 — submit 하지 않음.
              // nativeEvent.isComposing / keyCode 229 둘 다 체크 (일부 브라우저는 한쪽만 지원).
              const native = e.nativeEvent as KeyboardEvent & { isComposing?: boolean };
              if (e.key === "Enter" && !native.isComposing && native.keyCode !== 229) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            autoFocus
            className="h-10"
          />
          {/* 버튼을 Input 아래 별도 행으로 — 모바일 키보드 올라올 때 Input 옆 버튼이
              가려지던 문제 해결. 취소/확인 모두 명확히 tap 가능. */}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 min-w-20"
              onClick={submit}
              disabled={!value.trim()}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

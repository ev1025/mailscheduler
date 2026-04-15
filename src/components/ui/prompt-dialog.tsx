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
              if (e.key === "Enter") submit();
            }}
            placeholder={placeholder}
            autoFocus
            className="h-10"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button size="sm" onClick={submit} disabled={!value.trim()}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

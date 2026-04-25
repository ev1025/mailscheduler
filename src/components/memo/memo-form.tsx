"use client";

import { useState, useEffect } from "react";
import FormPage from "@/components/ui/form-page";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Memo } from "@/types";

interface MemoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memo?: Memo | null;
  onSave: (title: string, content: string) => Promise<{ error: unknown }>;
}

export default function MemoForm({
  open,
  onOpenChange,
  memo,
  onSave,
}: MemoFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (memo) {
      setTitle(memo.title);
      setContent(memo.content || "");
    } else {
      setTitle("");
      setContent("");
    }
  }, [memo, open]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await onSave(title.trim(), content.trim());
    setSaving(false);
    if (!error) onOpenChange(false);
  };

  return (
    <FormPage
      open={open}
      onOpenChange={onOpenChange}
      title={memo ? "메모 수정" : "새 메모"}
      submitDisabled={!title.trim()}
      saving={saving}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">
            제목<span className="text-rose-500 ml-0.5">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="메모 제목"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="content">내용</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="메모 내용을 입력하세요"
            rows={6}
          />
        </div>
      </div>
    </FormPage>
  );
}

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemos } from "@/hooks/use-memos";
import MemoCard from "@/components/memo/memo-card";
import MemoForm from "@/components/memo/memo-form";
import type { Memo } from "@/types";
import PageHeader from "@/components/layout/page-header";

export default function MemoPage() {
  const { memos, loading, addMemo, updateMemo, deleteMemo, togglePin } =
    useMemos();
  const [formOpen, setFormOpen] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);

  const handleSave = async (title: string, content: string) => {
    if (editingMemo) {
      return await updateMemo(editingMemo.id, { title, content });
    } else {
      return await addMemo(title, content);
    }
  };

  const handleEdit = (memo: Memo) => {
    setEditingMemo(memo);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteMemo(id);
  };

  const handleTogglePin = async (id: string, pinned: boolean) => {
    await togglePin(id, pinned);
  };

  return (
    <>
      <PageHeader
        title="메모"
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingMemo(null);
              setFormOpen(true);
            }}
            aria-label="새 메모"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
          >
            <Plus className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </button>
        }
      />
    <div className="p-4 md:p-6">

      {/* 페이지 전환 시 첫 렌더는 loading=true → empty 문구 플래시 방지 */}
      {loading ? (
        <div className="py-20" aria-hidden />
      ) : memos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg text-muted-foreground">메모가 없습니다</p>
          <p className="text-sm text-muted-foreground/60">
            위의 &quot;새 메모&quot; 버튼으로 첫 메모를 작성해보세요
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {memos.map((memo) => (
            <MemoCard
              key={memo.id}
              memo={memo}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      )}

      <MemoForm
        open={formOpen}
        onOpenChange={setFormOpen}
        memo={editingMemo}
        onSave={handleSave}
      />
    </div>
    </>
  );
}

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemos } from "@/hooks/use-memos";
import MemoCard from "@/components/memo/memo-card";
import MemoForm from "@/components/memo/memo-form";
import type { Memo } from "@/types";

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
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">메모</h2>
        <Button
          onClick={() => {
            setEditingMemo(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          새 메모
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
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
  );
}

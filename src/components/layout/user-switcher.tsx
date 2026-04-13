"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  useAppUsers,
  useCurrentUserId,
  setCurrentUserId,
  type AppUser,
} from "@/lib/current-user";

const PALETTE = [
  "#3B82F6", "#EC4899", "#22C55E", "#A855F7",
  "#F59E0B", "#EF4444", "#06B6D4", "#8B5CF6",
];

const EMOJIS = ["🙂", "💕", "🌸", "⭐", "🐱", "🍀", "☕", "🌙"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowClose?: boolean;
}

export default function UserSwitcher({
  open,
  onOpenChange,
  allowClose = true,
}: Props) {
  const { users, addUser, updateUser, deleteUser } = useAppUsers();
  const currentId = useCurrentUserId();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (!open) {
      setAdding(false);
      setEditingId(null);
      setNewName("");
    }
  }, [open]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const color = PALETTE[users.length % PALETTE.length];
    const emoji = EMOJIS[users.length % EMOJIS.length];
    const { data, error } = await addUser(newName.trim(), color, emoji);
    if (error) {
      alert("사용자 추가 실패: " + String(error));
      return;
    }
    if (data) {
      setNewName("");
      setAdding(false);
      if (!currentId) {
        setCurrentUserId(data.id);
        onOpenChange(false);
      }
    }
  };

  const pick = (u: AppUser) => {
    setCurrentUserId(u.id);
    onOpenChange(false);
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    await updateUser(id, { name: editName.trim() });
    setEditingId(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !allowClose && !currentId) return;
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton={allowClose}>
        <DialogHeader>
          <DialogTitle>누구세요?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {users.map((u) => {
            const isCurrent = u.id === currentId;
            const isEditing = editingId === u.id;
            return (
              <div
                key={u.id}
                className={`group flex items-center gap-3 rounded-lg border p-3 transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent cursor-pointer"
                }`}
                onClick={() => !isEditing && pick(u)}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                  style={{ backgroundColor: u.color + "30", color: u.color }}
                >
                  {u.emoji || u.name[0]}
                </div>
                {isEditing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate(u.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="h-8 flex-1"
                  />
                ) : (
                  <>
                    <span className="flex-1 font-medium">{u.name}</span>
                    {isCurrent && (
                      <span className="text-xs text-primary">선택됨</span>
                    )}
                  </>
                )}
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isEditing) {
                      handleUpdate(u.id);
                    } else {
                      setEditingId(u.id);
                      setEditName(u.name);
                    }
                  }}
                  title="이름 수정"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`"${u.name}" 사용자를 삭제할까요? 데이터도 함께 삭제됩니다.`)) {
                      deleteUser(u.id);
                    }
                  }}
                  title="삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          {adding ? (
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="이름"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewName("");
                  }
                }}
                className="h-9"
              />
              <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
                추가
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-4 w-4" />새 사용자 추가
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

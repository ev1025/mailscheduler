"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Upload, X, Check } from "lucide-react";
import {
  useAppUsers,
  useCurrentUserId,
  setCurrentUserId,
  type AppUser,
} from "@/lib/current-user";

const PALETTE = [
  "#3B82F6", "#EC4899", "#22C55E", "#A855F7",
  "#F59E0B", "#EF4444", "#06B6D4", "#8B5CF6",
  "#10B981", "#F97316",
];

const PRESET_EMOJIS = [
  "🙂", "💕", "🌸", "⭐", "🐱", "🍀", "☕", "🌙",
  "🐶", "🦊", "🐼", "🐰", "🐻", "🦁", "🐯", "🐸",
  "🌈", "🔥", "✨", "💎", "🎵", "🎨", "🚀", "⚡",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowClose?: boolean;
}

interface AvatarPickerProps {
  name: string;
  onNameChange: (v: string) => void;
  emoji: string;
  avatarUrl: string;
  color: string;
  onChange: (patch: {
    emoji?: string;
    avatarUrl?: string;
    color?: string;
  }) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
}

function AvatarPicker({
  name,
  onNameChange,
  emoji,
  avatarUrl,
  color,
  onChange,
  onCancel,
  onConfirm,
  confirmLabel,
}: AvatarPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      alert("500KB 이하 이미지만 선택할 수 있어요");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ avatarUrl: reader.result as string, emoji: "" });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 bg-muted/20">
      {/* 미리보기 + 이름 */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl overflow-hidden"
          style={
            avatarUrl
              ? { backgroundColor: "transparent" }
              : { backgroundColor: color + "30", color }
          }
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            emoji || (name ? name[0] : "?")
          )}
        </div>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="이름"
          autoFocus
          className="h-9 flex-1"
        />
      </div>

      {/* 이미지 업로드 */}
      <div className="flex gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          className="flex-1 h-8 text-xs"
        >
          <Upload className="mr-1 h-3 w-3" /> 이미지 업로드
        </Button>
        {avatarUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ avatarUrl: "" })}
            className="h-8"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {/* 프리셋 이모지 */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] text-muted-foreground">프리셋 이모지</Label>
        <div className="grid grid-cols-8 gap-1">
          {PRESET_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onChange({ emoji: e, avatarUrl: "" })}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-accent transition-colors ${
                emoji === e && !avatarUrl ? "ring-2 ring-primary" : ""
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* 색상 */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] text-muted-foreground">배경색</Label>
        <div className="flex gap-1.5 flex-wrap">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ color: c })}
              className={`h-5 w-5 rounded-full transition-all ${
                color === c
                  ? "ring-2 ring-offset-1 ring-primary scale-110"
                  : "hover:scale-110"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="h-8"
        >
          취소
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onConfirm}
          disabled={!name.trim()}
          className="h-8"
        >
          <Check className="mr-1 h-3 w-3" />
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

export default function UserSwitcher({
  open,
  onOpenChange,
  allowClose = true,
}: Props) {
  const { users, addUser, updateUser, deleteUser } = useAppUsers();
  const currentId = useCurrentUserId();

  // 추가 폼 상태
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🙂");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [newAvatar, setNewAvatar] = useState("");

  // 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editColor, setEditColor] = useState(PALETTE[0]);
  const [editAvatar, setEditAvatar] = useState("");

  useEffect(() => {
    if (!open) {
      setAdding(false);
      setEditingId(null);
      setNewName("");
      setNewEmoji("🙂");
      setNewColor(PALETTE[0]);
      setNewAvatar("");
    }
  }, [open]);

  const startAdd = () => {
    setAdding(true);
    setNewName("");
    setNewEmoji("🙂");
    setNewColor(PALETTE[users.length % PALETTE.length]);
    setNewAvatar("");
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const { data, error } = await addUser(
      newName.trim(),
      newColor,
      newEmoji,
      newAvatar
    );
    if (error) {
      alert("사용자 추가 실패: " + String(error));
      return;
    }
    if (data) {
      setAdding(false);
      if (!currentId) {
        setCurrentUserId(data.id);
        onOpenChange(false);
      }
    }
  };

  const startEdit = (u: AppUser) => {
    setEditingId(u.id);
    setEditName(u.name);
    setEditEmoji(u.emoji || "🙂");
    setEditColor(u.color || PALETTE[0]);
    setEditAvatar(u.avatar_url || "");
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;
    await updateUser(editingId, {
      name: editName.trim(),
      emoji: editAvatar ? null : editEmoji,
      color: editColor,
      avatar_url: editAvatar || null,
    });
    setEditingId(null);
  };

  const pick = (u: AppUser) => {
    setCurrentUserId(u.id);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !allowClose && !currentId) return;
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" showCloseButton={allowClose}>
        <DialogHeader>
          <DialogTitle>
            {users.length === 0 ? "프로필 만들기" : "프로필 선택"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {users.map((u) => {
            const isCurrent = u.id === currentId;
            const isEditing = editingId === u.id;
            if (isEditing) {
              return (
                <AvatarPicker
                  key={u.id}
                  name={editName}
                  onNameChange={setEditName}
                  emoji={editEmoji}
                  avatarUrl={editAvatar}
                  color={editColor}
                  onChange={(patch) => {
                    if (patch.emoji !== undefined) setEditEmoji(patch.emoji);
                    if (patch.avatarUrl !== undefined)
                      setEditAvatar(patch.avatarUrl);
                    if (patch.color !== undefined) setEditColor(patch.color);
                  }}
                  onCancel={() => setEditingId(null)}
                  onConfirm={handleUpdate}
                  confirmLabel="저장"
                />
              );
            }
            return (
              <div
                key={u.id}
                className={`group flex items-center gap-3 rounded-lg border p-3 transition-all cursor-pointer ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent"
                }`}
                onClick={() => pick(u)}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg overflow-hidden"
                  style={
                    u.avatar_url
                      ? { backgroundColor: "transparent" }
                      : { backgroundColor: u.color + "30", color: u.color }
                  }
                >
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.avatar_url}
                      alt={u.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    u.emoji || u.name[0]
                  )}
                </div>
                <span className="flex-1 font-medium">{u.name}</span>
                {isCurrent && (
                  <span className="text-xs text-primary">선택됨</span>
                )}
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(u);
                  }}
                  title="수정"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      confirm(
                        `"${u.name}" 프로필을 삭제할까요? 관련 데이터도 함께 삭제됩니다.`
                      )
                    ) {
                      deleteUser(u.id);
                      if (u.id === currentId) setCurrentUserId(null);
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
            <AvatarPicker
              name={newName}
              onNameChange={setNewName}
              emoji={newEmoji}
              avatarUrl={newAvatar}
              color={newColor}
              onChange={(patch) => {
                if (patch.emoji !== undefined) setNewEmoji(patch.emoji);
                if (patch.avatarUrl !== undefined) setNewAvatar(patch.avatarUrl);
                if (patch.color !== undefined) setNewColor(patch.color);
              }}
              onCancel={() => setAdding(false)}
              onConfirm={handleAdd}
              confirmLabel="프로필 만들기"
            />
          ) : (
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
              onClick={startAdd}
            >
              <Plus className="h-4 w-4" />새 프로필 추가
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

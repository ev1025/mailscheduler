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
import {
  Plus,
  Trash2,
  Upload,
  X,
  Check,
  LogIn,
  LogOut,
  ArrowLeft,
  Lock,
  Pencil,
  Share2,
} from "lucide-react";
import ShareManager from "@/components/calendar/share-manager";
import {
  useAppUsers,
  useCurrentUserId,
  setCurrentUserId,
  logout,
  isRemembered,
  addRememberedUser,
  removeRememberedUser,
  type AppUser,
} from "@/lib/current-user";
import { hashPassword, generateSalt } from "@/lib/auth";
import { toast } from "sonner";

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

type Mode = "list" | "create" | "login" | "edit" | "actions";

export default function UserSwitcher({
  open,
  onOpenChange,
  allowClose = true,
}: Props) {
  const { users, addUser, updateUser, deleteUser } = useAppUsers();
  const currentId = useCurrentUserId();

  const [mode, setMode] = useState<Mode>("list");
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // 생성 / 편집 상태
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🙂");
  const [color, setColor] = useState(PALETTE[0]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [remember, setRemember] = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setMode("list");
      setTargetUser(null);
      setName("");
      setEmoji("🙂");
      setColor(PALETTE[0]);
      setAvatarUrl("");
      setPassword("");
      setPasswordConfirm("");
      setRemember(true);
    }
  }, [open]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      alert("500KB 이하 이미지만 선택할 수 있어요");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result as string);
      setEmoji("");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const startCreate = () => {
    setMode("create");
    setName("");
    setEmoji("🙂");
    setColor(PALETTE[users.length % PALETTE.length]);
    setAvatarUrl("");
    setPassword("");
    setPasswordConfirm("");
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("이름을 입력하세요");
      return;
    }
    if (!password || password.length < 4) {
      toast.error("비밀번호는 4자 이상이어야 합니다");
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("비밀번호가 일치하지 않습니다");
      return;
    }
    const salt = generateSalt();
    const hash = await hashPassword(password, salt);
    const { data, error } = await addUser(
      name.trim(),
      color,
      emoji,
      avatarUrl,
      hash,
      salt
    );
    if (error || !data) {
      toast.error(
        typeof error === "string" ? error : "프로필 생성 실패 — SQL 확인 필요"
      );
      return;
    }
    toast.success(`${data.name} 프로필 생성됨`);
    // 생성자는 일단 로그인 (비번 없이), remember는 로그인 모달에서 설정
    setCurrentUserId(data.id, true);
    addRememberedUser(data.id); // 생성자 자신은 자동 로그인 기본 허용
    onOpenChange(false);
  };

  const startLogin = (u: AppUser) => {
    // 이미 로그인된 자기 프로필 클릭 → actions 메뉴
    if (currentId && u.id === currentId) {
      setTargetUser(u);
      setMode("actions");
      return;
    }
    // 이 기기에서 자동 로그인이 허용된 프로필이면 비번 스킵
    if (isRemembered(u.id)) {
      setCurrentUserId(u.id, true);
      onOpenChange(false);
      return;
    }
    // 그 외에는 항상 비밀번호 입력
    setTargetUser(u);
    setMode("login");
    setPassword("");
  };

  const handleLogin = async () => {
    if (!targetUser) return;
    if (!targetUser.password_salt || !targetUser.password_hash) {
      toast.error(
        "이 프로필은 비밀번호가 설정되지 않았습니다. 프로필 수정에서 비밀번호를 설정하세요."
      );
      return;
    }
    if (!password) {
      toast.error("비밀번호를 입력하세요");
      return;
    }
    const hash = await hashPassword(password, targetUser.password_salt);
    if (hash !== targetUser.password_hash) {
      toast.error("비밀번호가 틀렸어요");
      return;
    }
    setCurrentUserId(targetUser.id, true);
    if (remember) addRememberedUser(targetUser.id);
    else removeRememberedUser(targetUser.id);
    onOpenChange(false);
    toast.success(`${targetUser.name}님 환영합니다`);
  };

  const startEdit = (u: AppUser) => {
    setTargetUser(u);
    setMode("edit");
    setName(u.name);
    setEmoji(u.emoji || "🙂");
    setColor(u.color || PALETTE[0]);
    setAvatarUrl(u.avatar_url || "");
    setPassword("");
    setPasswordConfirm("");
  };

  const handleUpdate = async () => {
    if (!targetUser || !name.trim()) return;
    const updates: Partial<AppUser> = {
      name: name.trim(),
      emoji: avatarUrl ? null : emoji,
      color,
      avatar_url: avatarUrl || null,
    };
    if (password) {
      if (password.length < 4) {
        toast.error("비밀번호는 4자 이상이어야 합니다");
        return;
      }
      if (password !== passwordConfirm) {
        toast.error("비밀번호가 일치하지 않습니다");
        return;
      }
      const salt = generateSalt();
      const hash = await hashPassword(password, salt);
      updates.password_hash = hash;
      updates.password_salt = salt;
    }
    const { error } = await updateUser(targetUser.id, updates);
    if (error) {
      toast.error(typeof error === "string" ? error : "저장 실패");
      return;
    }
    toast.success("수정되었습니다");
    setMode("list");
  };

  const handleLogout = () => {
    if (currentId) removeRememberedUser(currentId);
    logout();
    setMode("list");
    toast.success("로그아웃되었습니다");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !allowClose && !currentId) return;
        onOpenChange(o);
      }}
    >
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        showCloseButton={allowClose}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            {(mode === "create" ||
              mode === "login" ||
              mode === "edit" ||
              mode === "actions") && (
              <button
                type="button"
                onClick={() => setMode("list")}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <DialogTitle>
              {mode === "list" && (users.length === 0 ? "프로필 만들기" : currentId ? "프로필" : "로그인")}
              {mode === "create" && "새 프로필 만들기"}
              {mode === "login" && `${targetUser?.name}님 로그인`}
              {mode === "edit" && `${targetUser?.name} 수정`}
              {mode === "actions" && "내 프로필"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* LIST MODE */}
        {mode === "list" && (
          <div className="flex flex-col gap-2">
            {users.map((u) => {
              const isCurrent = u.id === currentId;
              return (
                <div
                  key={u.id}
                  className={`group flex items-center gap-3 rounded-lg border p-3 transition-all cursor-pointer ${
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => startLogin(u)}
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{u.name}</span>
                      {isRemembered(u.id) ? (
                        <span className="text-[9px] text-green-600 border border-green-300 bg-green-50 rounded px-1">
                          자동 로그인
                        </span>
                      ) : u.password_hash ? (
                        <Lock className="h-3 w-3 text-primary" />
                      ) : null}
                    </div>
                  </div>
                  </div>
              );
            })}

            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
              onClick={startCreate}
            >
              <Plus className="h-4 w-4" />새 프로필 만들기
            </button>

          </div>
        )}

        {/* LOGIN MODE */}
        {mode === "login" && targetUser && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-xl overflow-hidden"
                style={
                  targetUser.avatar_url
                    ? { backgroundColor: "transparent" }
                    : {
                        backgroundColor: targetUser.color + "30",
                        color: targetUser.color,
                      }
                }
              >
                {targetUser.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={targetUser.avatar_url}
                    alt={targetUser.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  targetUser.emoji || targetUser.name[0]
                )}
              </div>
              <span className="font-semibold">{targetUser.name}</span>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">비밀번호</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
                autoFocus
                className="h-9"
              />
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              자동 로그인
            </label>

            <Button onClick={handleLogin} className="w-full">
              <LogIn className="mr-1 h-4 w-4" />
              로그인
            </Button>
          </div>
        )}

        {/* ACTIONS MODE — 자기 프로필 클릭 시 */}
        {mode === "actions" && targetUser && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3 mb-1">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-xl overflow-hidden"
                style={
                  targetUser.avatar_url
                    ? { backgroundColor: "transparent" }
                    : {
                        backgroundColor: targetUser.color + "30",
                        color: targetUser.color,
                      }
                }
              >
                {targetUser.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={targetUser.avatar_url}
                    alt={targetUser.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  targetUser.emoji || targetUser.name[0]
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{targetUser.name}</p>
                <p className="text-[11px] text-muted-foreground">로그인 중</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => startEdit(targetUser)}
              className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
              <span>프로필 편집</span>
            </button>

            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
            >
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <span>캘린더 공유</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    `"${targetUser.name}" 프로필과 모든 데이터를 삭제할까요?`
                  )
                ) {
                  deleteUser(targetUser.id);
                  removeRememberedUser(targetUser.id);
                  logout();
                  setMode("list");
                  toast.success("프로필이 삭제되었습니다");
                }
              }}
              className="flex items-center gap-3 rounded-lg border border-destructive/30 p-3 text-sm text-destructive hover:bg-destructive/5 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>프로필 삭제</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleLogout();
              }}
              className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
              <span>로그아웃</span>
            </button>
          </div>
        )}

        {/* CREATE / EDIT MODE */}
        {(mode === "create" || mode === "edit") && (
          <div className="flex flex-col gap-3">
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
                onChange={(e) => setName(e.target.value)}
                placeholder="이름"
                autoFocus
                className="h-9 flex-1"
              />
            </div>

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
                  onClick={() => setAvatarUrl("")}
                  className="h-8"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">
                프리셋 이모지
              </Label>
              <div className="grid grid-cols-8 gap-1">
                {PRESET_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setEmoji(e);
                      setAvatarUrl("");
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-accent transition-colors ${
                      emoji === e && !avatarUrl
                        ? "ring-2 ring-primary"
                        : ""
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">배경색</Label>
              <div className="flex gap-1.5 flex-wrap">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
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

            <div className="flex flex-col gap-1 pt-2 border-t">
              <Label className="text-[10px] text-muted-foreground">
                {mode === "edit" ? "새 비밀번호 (비우면 변경 안 함)" : "비밀번호 (선택)"}
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="h-9"
              />
              {password && (
                <Input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호 확인"
                  className="h-9"
                />
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMode("list")}
                className="h-8"
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={mode === "create" ? handleCreate : handleUpdate}
                disabled={!name.trim()}
                className="h-8"
              >
                <Check className="mr-1 h-3 w-3" />
                {mode === "create" ? "만들기" : "저장"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
      <ShareManager open={shareOpen} onOpenChange={setShareOpen} />
    </Dialog>
  );
}

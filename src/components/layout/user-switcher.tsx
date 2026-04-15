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
  Mail,
  LogOut,
  Share2,
} from "lucide-react";
import ShareManager from "@/components/calendar/share-manager";
import AvatarCropDialog from "./avatar-crop-dialog";
import {
  useAppUsers,
  useCurrentUser,
  type AppUser,
} from "@/lib/current-user";
import {
  sendMagicLink,
  supabaseSignOut,
  useSupabaseAuth,
} from "@/lib/auth-supabase";
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

// Mode:
//  - signin: Supabase Auth 세션 없음 → 이메일 매직링크 전송
//  - setup : 세션 있으나 app_users 프로필 없음 → 최초 프로필 생성
//  - edit  : 세션 + 프로필 있음 → 내 프로필 편집
type Mode = "signin" | "setup" | "edit";

export default function UserSwitcher({ open, onOpenChange, allowClose = true }: Props) {
  const { user: authUser, loading: authLoading } = useSupabaseAuth();
  const { users, loading: usersLoading, addUser, updateUser, deleteUser, refetch } = useAppUsers();
  const currentUser = useCurrentUser();

  const [shareOpen, setShareOpen] = useState(false);

  // 이메일 매직링크 폼
  const [emailInput, setEmailInput] = useState("");
  const [emailStatus, setEmailStatus] = useState<
    { type: "idle" | "sending" | "sent" | "error"; message?: string }
  >({ type: "idle" });

  // 프로필 생성/편집 폼
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🙂");
  const [color, setColor] = useState(PALETTE[0]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  // 현재 모드 계산 (auth 상태 + 프로필 유무)
  const mode: Mode = !authUser ? "signin" : currentUser ? "edit" : "setup";

  // 모달 열릴 때마다 목록 재조회 (다른 기기에서 바뀐 프로필 반영)
  useEffect(() => {
    if (open) refetch();
  }, [open, refetch]);

  // edit 모드 진입 시 현재 프로필 값 로드
  useEffect(() => {
    if (mode === "edit" && currentUser) {
      setName(currentUser.name);
      setEmoji(currentUser.emoji || "🙂");
      setColor(currentUser.color || PALETTE[0]);
      setAvatarUrl(currentUser.avatar_url || "");
    }
    if (mode === "setup") {
      setName("");
      setEmoji("🙂");
      setColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
      setAvatarUrl("");
    }
  }, [mode, currentUser]);

  const handleSendMagicLink = async () => {
    setEmailStatus({ type: "sending" });
    const { error } = await sendMagicLink(emailInput);
    if (error) {
      setEmailStatus({ type: "error", message: error });
      return;
    }
    setEmailStatus({
      type: "sent",
      message: `${emailInput.trim()}으로 로그인 링크를 보냈습니다. 메일함을 확인해주세요.`,
    });
  };

  const handleCreateProfile = async () => {
    if (!authUser) return;
    if (!name.trim()) {
      toast.error("이름을 입력하세요");
      return;
    }
    setSaving(true);
    const { error } = await addUser(
      authUser.id,
      name.trim(),
      color,
      avatarUrl ? undefined : emoji,
      avatarUrl || undefined
    );
    setSaving(false);
    if (error) {
      toast.error(typeof error === "string" ? error : "프로필 생성 실패");
      return;
    }
    onOpenChange(false);
  };

  const handleUpdateProfile = async () => {
    if (!currentUser || !name.trim()) return;
    setSaving(true);
    const { error } = await updateUser(currentUser.id, {
      name: name.trim(),
      emoji: avatarUrl ? null : emoji,
      color,
      avatar_url: avatarUrl || null,
    });
    setSaving(false);
    if (error) {
      toast.error(typeof error === "string" ? error : "저장 실패");
      return;
    }
    onOpenChange(false);
  };

  const handleSignOut = async () => {
    await supabaseSignOut();
    onOpenChange(false);
  };

  const handleDeleteProfile = async () => {
    if (!currentUser) return;
    if (!confirm("프로필과 Supabase 로그인 세션을 삭제합니다. 계속할까요?")) return;
    await deleteUser(currentUser.id);
    await supabaseSignOut();
    onOpenChange(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) {
      toast.error("10MB 이하 이미지만 선택할 수 있어요");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const isLoading = authLoading || usersLoading;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !allowClose && !authUser) return;
        onOpenChange(o);
      }}
    >
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        showBackButton={allowClose}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "signin" && "로그인"}
            {mode === "setup" && "프로필 만들기"}
            {mode === "edit" && "내 프로필"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">불러오는 중...</p>
        ) : mode === "signin" ? (
          /* SIGN IN — Supabase 매직링크 */
          <div className="flex flex-col gap-3">
            {emailStatus.type === "sent" ? (
              <div className="flex flex-col gap-2 rounded-md border bg-green-50 p-4 text-sm text-green-900">
                <div className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4" />
                  메일 발송 완료
                </div>
                <p className="text-xs">{emailStatus.message}</p>
                <p className="text-[11px] text-green-700">
                  메일 수신 후 링크를 누르면 자동으로 로그인됩니다. 스팸함도 확인해보세요.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  이메일로 로그인 링크를 보내드립니다. 비밀번호는 필요 없어요.
                </p>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">이메일</Label>
                  <Input
                    type="email"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (emailStatus.type === "error") setEmailStatus({ type: "idle" });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendMagicLink();
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    className="h-9"
                  />
                </div>
                {emailStatus.type === "error" && (
                  <p className="text-xs text-destructive">{emailStatus.message}</p>
                )}
                <Button
                  onClick={handleSendMagicLink}
                  disabled={emailStatus.type === "sending" || !emailInput.trim()}
                  className="w-full"
                >
                  <Mail className="mr-1 h-4 w-4" />
                  {emailStatus.type === "sending" ? "보내는 중..." : "로그인 링크 받기"}
                </Button>
              </>
            )}
          </div>
        ) : (
          /* SETUP or EDIT — 프로필 생성/편집 */
          <div className="flex flex-col gap-3">
            {mode === "setup" && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{authUser?.email}</span>로 로그인됐어요.
                프로필 정보를 입력하면 시작할 수 있어요.
              </p>
            )}

            {/* 이름 */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">이름 (표시용)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름"
                className="h-9"
                autoFocus={mode === "setup"}
              />
            </div>

            {/* 아바타 미리보기 */}
            <div className="flex items-center gap-3 pt-1">
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
                  <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  emoji || (name ? name[0] : "?")
                )}
              </div>
              <span className="text-xs text-muted-foreground">아래에서 이미지/이모지/색상을 선택하세요</span>
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

            {/* 이모지 */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">프리셋 이모지</Label>
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
                    onClick={() => setColor(c)}
                    className={`h-5 w-5 rounded-full transition-all ${
                      color === c ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* 저장 / 취소 */}
            <div className="flex gap-2 justify-end">
              {mode === "edit" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-8"
                >
                  취소
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={mode === "setup" ? handleCreateProfile : handleUpdateProfile}
                disabled={!name.trim() || saving}
                className="h-8"
              >
                <Check className="mr-1 h-3 w-3" />
                {mode === "setup" ? "시작하기" : "저장"}
              </Button>
            </div>

            {/* edit 모드에서만 액션 영역 */}
            {mode === "edit" && (
              <div className="border-t pt-3 mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-md border p-2.5 text-xs hover:bg-accent transition-colors"
                >
                  <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                  일정 공유
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center justify-center gap-2 rounded-md border p-2.5 text-xs hover:bg-accent transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                  로그아웃
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProfile}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-md border border-destructive/30 p-2.5 text-xs text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  프로필 삭제
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
      <ShareManager open={shareOpen} onOpenChange={setShareOpen} />
      <AvatarCropDialog
        src={cropSrc}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onConfirm={(dataUrl) => {
          setAvatarUrl(dataUrl);
          setEmoji("");
        }}
      />
    </Dialog>
  );
}

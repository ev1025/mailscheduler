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
  Upload,
  Check,
  Mail,
} from "lucide-react";
import AvatarCropDialog from "./avatar-crop-dialog";
import {
  useAppUsers,
  useCurrentUser,
} from "@/lib/current-user";
import {
  sendMagicLink,
  useSupabaseAuth,
} from "@/lib/auth-supabase";
import { uploadToStorage } from "@/lib/storage";
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

// signin: 로그인 필요 (매직링크)
// setup : 프로필 최초 생성
// 편집은 /profile 엔드포인트에서 처리 (이 컴포넌트는 게이트 전용)
type Mode = "signin" | "setup";

export default function UserSwitcher({ open, onOpenChange, allowClose = true }: Props) {
  const { user: authUser, loading: authLoading } = useSupabaseAuth();
  const { loading: usersLoading, addUser } = useAppUsers();
  const currentUser = useCurrentUser();

  const [emailInput, setEmailInput] = useState("");
  const [emailStatus, setEmailStatus] = useState<
    { type: "idle" | "sending" | "sent" | "error"; message?: string }
  >({ type: "idle" });

  // 프로필 최초 생성 폼
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🙂");
  const [color, setColor] = useState(PALETTE[0]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const mode: Mode = !authUser ? "signin" : "setup";

  useEffect(() => {
    if (mode === "setup" && !avatarUrl && !name) {
      setEmoji("🙂");
      setColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    }
  }, [mode, avatarUrl, name]);

  const handleSendMagicLink = async () => {
    setEmailStatus({ type: "sending" });
    const { error } = await sendMagicLink(emailInput);
    if (error) {
      setEmailStatus({ type: "error", message: error });
      return;
    }
    setEmailStatus({
      type: "sent",
      message: `${emailInput.trim()}으로 로그인 링크를 보냈습니다.`,
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
    // 성공 시 currentUser가 업데이트되면서 AppShell 게이트가 자동으로 닫힘
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
  // 이미 로그인 + 프로필 있으면 이 다이얼로그는 뜨면 안 됨 (AppShell이 제어)
  void currentUser;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && cropOpen) return;
        if (!o && !allowClose) return;
        onOpenChange(o);
      }}
    >
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        showBackButton={allowClose}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "signin" ? "로그인" : "프로필 만들기"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">불러오는 중...</p>
        ) : mode === "signin" ? (
          /* SIGN IN — 매직링크 */
          <div className="flex flex-col gap-3">
            {emailStatus.type === "sent" ? (
              <div className="flex flex-col gap-2 rounded-md border bg-green-50 p-4 text-sm text-green-900">
                <div className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4" />
                  메일 발송 완료
                </div>
                <p className="text-xs">{emailStatus.message}</p>
                <p className="text-xs text-green-700">
                  메일 수신 후 링크를 누르면 자동으로 로그인됩니다. 스팸함도 확인해보세요.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  이메일로 로그인 링크를 보내드립니다. 비밀번호는 필요 없어요.
                </p>
                <div className="flex flex-col gap-1.5">
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
                    className="h-10"
                  />
                </div>
                {emailStatus.type === "error" && (
                  <p className="text-xs text-destructive">{emailStatus.message}</p>
                )}
                <Button
                  onClick={handleSendMagicLink}
                  disabled={emailStatus.type === "sending" || !emailInput.trim()}
                  className="w-full h-10"
                >
                  <Mail className="mr-1 h-4 w-4" />
                  {emailStatus.type === "sending" ? "보내는 중..." : "로그인 링크 받기"}
                </Button>
              </>
            )}
          </div>
        ) : (
          /* SETUP — 프로필 최초 생성 */
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{authUser?.email}</span>로 로그인됐어요.
              프로필 정보를 입력하면 시작할 수 있어요.
            </p>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">이름 (표시용)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름"
                className="h-10"
                autoFocus
              />
            </div>

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

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="flex-1 h-9"
              >
                <Upload className="mr-1 h-4 w-4" /> 이미지 업로드
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAvatarUrl("")}
                  className="h-9 text-xs"
                >
                  이미지 초기화
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

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">프리셋 이모지</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {PRESET_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setEmoji(e);
                      setAvatarUrl("");
                    }}
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-accent transition-colors ${
                      emoji === e && !avatarUrl ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">배경색</Label>
              <div className="flex gap-2 flex-wrap">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full transition-all ${
                      color === c ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <Button
              type="button"
              onClick={handleCreateProfile}
              disabled={!name.trim() || saving}
              className="h-10 mt-1"
            >
              <Check className="mr-1 h-4 w-4" />
              {saving ? "저장 중..." : "시작하기"}
            </Button>
          </div>
        )}
      </DialogContent>
      <AvatarCropDialog
        src={cropSrc}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onConfirm={async (dataUrl) => {
          const { url, error } = await uploadToStorage("avatars", dataUrl, "jpg");
          if (error || !url) {
            toast.error(error || "이미지 업로드 실패");
            return;
          }
          setAvatarUrl(url);
          setEmoji("");
        }}
      />
    </Dialog>
  );
}

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Upload,
  Check,
  LogOut,
  Share2,
  Settings as SettingsIcon,
  Trash2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSupabaseAuth, supabaseSignOut } from "@/lib/auth-supabase";
import { useAppUsers, useCurrentUser } from "@/lib/current-user";
import { uploadToStorage, deleteFromStorage } from "@/lib/storage";
import AvatarCropDialog from "@/components/layout/avatar-crop-dialog";
import ShareManager from "@/components/calendar/share-manager";
import PageHeader from "@/components/layout/page-header";
import ColorPickerRow from "@/components/ui/color-picker-popover";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import PasswordChangeDialog from "@/components/layout/password-change-dialog";

const DEFAULT_COLOR = "#3B82F6";

const PRESET_EMOJIS = [
  "🙂", "💕", "🌸", "⭐", "🐱", "🍀", "☕", "🌙",
  "🐶", "🦊", "🐼", "🐰", "🐻", "🦁", "🐯", "🐸",
  "🌈", "🔥", "✨", "💎", "🎵", "🎨", "🚀", "⚡",
];

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageInner />
    </Suspense>
  );
}

function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: authUser, loading: authLoading } = useSupabaseAuth();
  const { users, updateUser, deleteUser } = useAppUsers();
  const currentUser = useCurrentUser();

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🙂");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarMode, setAvatarMode] = useState<"image" | "emoji">("emoji");
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // 비밀번호 변경 다이얼로그
  const [pwDialogOpen, setPwDialogOpen] = useState(false);

  // URL의 ?action=reset-password 로 진입하면 즉시 다이얼로그 오픈
  // (AppShell이 PASSWORD_RECOVERY 이벤트를 잡아서 이 URL로 리다이렉트)
  useEffect(() => {
    if (searchParams.get("action") === "reset-password") {
      setPwDialogOpen(true);
      toast.info("새 비밀번호를 설정하세요");
      // 쿼리 정리 (다이얼로그 닫고 다시 돌아와도 재오픈되지 않도록)
      router.replace("/profile", { scroll: false });
    }
  }, [searchParams, router]);

  // 로그인 안 됐거나 프로필 없으면 홈으로 (AppShell의 게이트가 signin/setup 처리)
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      router.replace("/");
      return;
    }
    // users state 아직 비어있을 수 있으므로 currentUser 확인은 화면에서만
  }, [authLoading, authUser, router]);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setEmoji(currentUser.emoji || "🙂");
      setColor(currentUser.color || DEFAULT_COLOR);
      setAvatarUrl(currentUser.avatar_url || "");
      setAvatarMode(currentUser.avatar_url ? "image" : "emoji");
    }
  }, [currentUser]);

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

  const handleUpdate = async () => {
    if (!currentUser || !name.trim()) {
      toast.error("이름을 입력하세요");
      return;
    }
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
    toast.success("저장됐어요");
  };

  const handleSignOut = async () => {
    await supabaseSignOut();
    router.replace("/");
  };

  const handleDeleteProfile = async () => {
    if (!currentUser) return;
    await deleteUser(currentUser.id);
    await supabaseSignOut();
    router.replace("/");
  };

  if (authLoading || !currentUser) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  return (
    <>
      <PageHeader title="내 프로필" showBack showBell />
    <div className="px-4 pt-3 pb-6 md:px-6 md:pt-6 md:pb-10 max-w-xl mx-auto">

      <div className="flex flex-col gap-3.5">
        {/* 헤더 — 아바타 + 이름 + 이메일 (압축) */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (avatarMode === "image") fileRef.current?.click();
            }}
            className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-4xl overflow-hidden ring-1 ring-border/40 transition-transform active:scale-95"
            style={
              avatarUrl
                ? { backgroundColor: "transparent" }
                : { backgroundColor: color + "30", color }
            }
            aria-label="아바타 변경"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              emoji || (name ? name[0] : "?")
            )}
          </button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="h-8 text-center text-[15px] font-semibold border-none bg-transparent focus-visible:ring-0 focus-visible:border-b focus-visible:border-border rounded-none shadow-none px-0"
          />
          <p className="text-[11px] text-muted-foreground/80 -mt-1">{authUser?.email}</p>
        </div>

        {/* 이미지/이모지 세그먼트 — 더 작게 */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setAvatarMode("image")}
              className={`px-3 py-1 rounded-full transition-colors ${
                avatarMode === "image"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              이미지
            </button>
            <button
              type="button"
              onClick={() => {
                setAvatarMode("emoji");
                setAvatarUrl("");
              }}
              className={`px-3 py-1 rounded-full transition-colors ${
                avatarMode === "emoji"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              이모지
            </button>
          </div>
        </div>

        {avatarMode === "image" ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              className="flex-1 h-9"
            >
              <Upload className="mr-1 h-3.5 w-3.5" /> 이미지 업로드
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAvatarUrl("")}
                className="h-9"
              >
                초기화
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
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {PRESET_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setEmoji(e);
                  setAvatarUrl("");
                }}
                className={`flex h-8 w-full items-center justify-center rounded-md text-base hover:bg-accent transition-colors ${
                  emoji === e && !avatarUrl ? "ring-2 ring-primary" : ""
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* 배경색 — 이모지 모드일 때만 (라벨 제거, ColorPickerRow 만) */}
        {avatarMode === "emoji" && !avatarUrl && (
          <ColorPickerRow color={color} onChange={setColor} />
        )}

        {/* 저장 */}
        <Button
          type="button"
          onClick={handleUpdate}
          disabled={!name.trim() || saving}
          className="h-9"
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          {saving ? "저장 중..." : "저장"}
        </Button>

        {/* 액션 타일 — 2x2 compact grid */}
        <div className="grid grid-cols-2 gap-1.5 border-t pt-3 mt-1">
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="flex items-center justify-center gap-1.5 rounded-md border p-2.5 text-xs hover:bg-accent transition-colors"
          >
            <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground" />
            설정
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-md border p-2.5 text-xs hover:bg-accent transition-colors"
          >
            <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
            일정 공유
          </button>
          <button
            type="button"
            onClick={() => setPwDialogOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-md border p-2.5 text-xs hover:bg-accent transition-colors"
          >
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            비밀번호 변경
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center justify-center gap-1.5 rounded-md border p-2.5 text-xs hover:bg-accent transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
            로그아웃
          </button>
        </div>

        {/* 위험 영역 — subtle text link (iOS 설정 앱 하단 스타일) */}
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-destructive underline-offset-4 hover:underline transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            프로필 삭제
          </button>
        </div>
      </div>

      <AvatarCropDialog
        src={cropSrc}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onConfirm={async (dataUrl) => {
          const prevUrl = avatarUrl;
          const { url, error } = await uploadToStorage("avatars", dataUrl, "jpg");
          if (error || !url) {
            toast.error(error || "이미지 업로드 실패");
            return;
          }
          setAvatarUrl(url);
          setEmoji("");
          if (prevUrl && prevUrl.includes("/storage/v1/object/public/avatars/")) {
            deleteFromStorage("avatars", prevUrl);
          }
        }}
      />

      <ShareManager open={shareOpen} onOpenChange={setShareOpen} />

      <PasswordChangeDialog open={pwDialogOpen} onOpenChange={setPwDialogOpen} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="프로필 삭제"
        description="프로필과 로그인 세션이 삭제됩니다."
        confirmLabel="삭제"
        destructive
        onConfirm={handleDeleteProfile}
      />
    </div>
    </>
  );
}

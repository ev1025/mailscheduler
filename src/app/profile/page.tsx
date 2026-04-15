"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  Check,
  LogOut,
  Share2,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSupabaseAuth, supabaseSignOut } from "@/lib/auth-supabase";
import { useAppUsers, useCurrentUser } from "@/lib/current-user";
import { uploadToStorage, deleteFromStorage } from "@/lib/storage";
import AvatarCropDialog from "@/components/layout/avatar-crop-dialog";
import ShareManager from "@/components/calendar/share-manager";
import MobileBell from "@/components/layout/mobile-bell";

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

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useSupabaseAuth();
  const { users, updateUser, deleteUser } = useAppUsers();
  const currentUser = useCurrentUser();

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🙂");
  const [color, setColor] = useState(PALETTE[0]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

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
      setColor(currentUser.color || PALETTE[0]);
      setAvatarUrl(currentUser.avatar_url || "");
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
    if (!confirm("프로필과 로그인 세션을 삭제합니다. 계속할까요?")) return;
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
    <div className="p-4 md:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="뒤로"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">내 프로필</h1>
      </div>

      <div className="flex flex-col gap-4">
        {/* 이메일 (읽기 전용) */}
        <div className="rounded-md bg-muted/40 p-3 text-sm">
          <span className="text-xs text-muted-foreground">로그인 이메일</span>
          <p className="font-medium">{authUser?.email}</p>
        </div>

        {/* 이름 */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">이름 (표시용)</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="h-10 text-base"
          />
        </div>

        {/* 아바타 미리보기 */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl overflow-hidden"
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
          <span className="text-xs text-muted-foreground">
            아래에서 이미지 / 이모지 / 색상을 선택하세요
          </span>
        </div>

        {/* 이미지 업로드 */}
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
              className="h-9"
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

        {/* 이모지 */}
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

        {/* 색상 */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">배경색</Label>
          <div className="flex gap-2 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition-all ${
                  color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-110"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* 저장 */}
        <Button
          type="button"
          onClick={handleUpdate}
          disabled={!name.trim() || saving}
          className="h-10 mt-1"
        >
          <Check className="mr-1 h-4 w-4" />
          {saving ? "저장 중..." : "저장"}
        </Button>

        {/* 액션 영역 */}
        <div className="border-t pt-4 mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="flex items-center justify-center gap-2 rounded-md border p-3 text-sm hover:bg-accent transition-colors"
          >
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
            설정
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex items-center justify-center gap-2 rounded-md border p-3 text-sm hover:bg-accent transition-colors"
          >
            <Share2 className="h-4 w-4 text-muted-foreground" />
            일정 공유
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 rounded-md border p-3 text-sm hover:bg-accent transition-colors"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
            로그아웃
          </button>
          <button
            type="button"
            onClick={handleDeleteProfile}
            className="flex items-center justify-center gap-2 rounded-md border border-destructive/30 p-3 text-sm text-destructive hover:bg-destructive/5 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
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
    </div>
  );
}

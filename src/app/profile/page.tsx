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
import PageHeader from "@/components/layout/page-header";
import ColorPickerRow from "@/components/ui/color-picker-popover";

const DEFAULT_COLOR = "#3B82F6";

function TileButton({
  icon,
  label,
  onClick,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger";
}) {
  const danger = tone === "danger";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-center justify-center gap-2 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border transition-all active:scale-[0.98] hover:shadow-md ${
        danger ? "text-destructive" : "text-foreground"
      }`}
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
          danger
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
        }`}
      >
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

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
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarMode, setAvatarMode] = useState<"image" | "emoji">("emoji");
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
    <>
      <PageHeader title="내 프로필" showBack />
    <div className="p-4 md:p-6 max-w-xl mx-auto">

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

        {/* 아바타 미리보기 + 이미지/이모지 토글 */}
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
          <div className="flex rounded-md border p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setAvatarMode("image")}
              className={`px-3 py-1.5 rounded ${avatarMode === "image" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              이미지
            </button>
            <button
              type="button"
              onClick={() => {
                setAvatarMode("emoji");
                setAvatarUrl("");
              }}
              className={`px-3 py-1.5 rounded ${avatarMode === "emoji" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
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
              className="flex-1 h-10"
            >
              <Upload className="mr-1 h-4 w-4" /> 이미지 업로드
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAvatarUrl("")}
                className="h-10"
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
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">이모지</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setEmoji(e);
                    setAvatarUrl("");
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-md text-lg hover:bg-accent transition-colors ${
                    emoji === e && !avatarUrl ? "ring-2 ring-primary" : ""
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 배경색 — ColorPickerRow(8 presets + custom picker) */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">배경색</Label>
          <ColorPickerRow color={color} onChange={setColor} />
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

        {/* 타일 카드 액션 그리드 */}
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-3">
            <TileButton
              onClick={() => router.push("/settings")}
              icon={<SettingsIcon className="h-6 w-6" strokeWidth={1.6} />}
              label="설정"
              tone="neutral"
            />
            <TileButton
              onClick={() => setShareOpen(true)}
              icon={<Share2 className="h-6 w-6" strokeWidth={1.6} />}
              label="일정 공유"
              tone="neutral"
            />
            <TileButton
              onClick={handleSignOut}
              icon={<LogOut className="h-6 w-6" strokeWidth={1.6} />}
              label="로그아웃"
              tone="neutral"
            />
            <TileButton
              onClick={handleDeleteProfile}
              icon={<Trash2 className="h-6 w-6" strokeWidth={1.6} />}
              label="프로필 삭제"
              tone="danger"
            />
          </div>
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
    </>
  );
}

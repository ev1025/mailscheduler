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

type Mode = "list" | "create" | "edit" | "forgot";

const LOGIN_ID_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function UserSwitcher({
  open,
  onOpenChange,
  allowClose = true,
}: Props) {
  const { users, addUser, updateUser, deleteUser, refetch } = useAppUsers();
  const currentId = useCurrentUserId();

  // 모달 열릴 때마다 최신 유저 목록 가져오기
  useEffect(() => {
    if (open) refetch();
  }, [open, refetch]);

  // 로그인 상태에서 모달 열리면 자동으로 내 프로필 편집 화면으로
  useEffect(() => {
    if (!open || !currentId || users.length === 0) return;
    const me = users.find((u) => u.id === currentId);
    if (me && mode === "list") {
      startEdit(me);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentId, users]);

  const [mode, setMode] = useState<Mode>("list");
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [pwChangeConfirmOpen, setPwChangeConfirmOpen] = useState(false);
  const [pwChangeCurrent, setPwChangeCurrent] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  // 로그인 폼 상태 (list 모드에서 입력)
  const [loginIdInput, setLoginIdInput] = useState("");
  const [loginPwInput, setLoginPwInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [rememberLogin, setRememberLogin] = useState(false);

  // 생성 / 편집 상태
  const [loginId, setLoginId] = useState("");
  const [name, setName] = useState("");
  const [recoveryQuestion, setRecoveryQuestion] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");

  // 비밀번호 찾기(forgot) 상태
  const [forgotId, setForgotId] = useState("");
  const [forgotTarget, setForgotTarget] = useState<AppUser | null>(null);
  const [forgotAnswer, setForgotAnswer] = useState("");
  const [forgotNewPw, setForgotNewPw] = useState("");
  const [forgotNewPwConfirm, setForgotNewPwConfirm] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotStep, setForgotStep] = useState<"id" | "answer" | "reset">("id");
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
      setLoginId("");
      setName("");
      setRecoveryQuestion("");
      setRecoveryAnswer("");
      setEmoji("🙂");
      setColor(PALETTE[0]);
      setAvatarUrl("");
      setPassword("");
      setPasswordConfirm("");
      setRemember(true);
      setLoginIdInput("");
      setLoginPwInput("");
      setLoginError(null);
      setRememberLogin(false);
      setForgotId("");
      setForgotTarget(null);
      setForgotAnswer("");
      setForgotNewPw("");
      setForgotNewPwConfirm("");
      setForgotError(null);
      setForgotStep("id");
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
    setLoginId("");
    setName("");
    setEmoji("🙂");
    setColor(PALETTE[users.length % PALETTE.length]);
    setAvatarUrl("");
    setPassword("");
    setPasswordConfirm("");
  };

  const handleCreate = async () => {
    if (!loginId.trim()) {
      toast.error("로그인 아이디를 입력하세요");
      return;
    }
    if (!LOGIN_ID_RE.test(loginId.trim())) {
      toast.error("아이디는 영문/숫자/_ 3~20자");
      return;
    }
    if (users.some((u) => u.login_id === loginId.trim())) {
      toast.error("이미 사용 중인 아이디입니다");
      return;
    }
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

    // 복구 질문/답변은 선택. 둘 다 입력 시에만 저장.
    let recoveryQ: string | undefined;
    let recoveryAH: string | undefined;
    let recoveryAS: string | undefined;
    if (recoveryQuestion.trim() && recoveryAnswer.trim()) {
      recoveryQ = recoveryQuestion.trim();
      recoveryAS = generateSalt();
      recoveryAH = await hashPassword(
        recoveryAnswer.trim().toLowerCase(),
        recoveryAS
      );
    }

    const { data, error } = await addUser(
      name.trim(),
      color,
      emoji,
      avatarUrl,
      hash,
      salt,
      loginId.trim(),
      recoveryQ,
      recoveryAH,
      recoveryAS
    );
    if (error || !data) {
      toast.error(
        typeof error === "string" ? error : "프로필 생성 실패 — SQL 확인 필요"
      );
      return;
    }
    // 생성자는 세션으로만 로그인 (자동 로그인 X). 다음 접속 시 비번 입력 필요.
    setCurrentUserId(data.id, false);
    onOpenChange(false);
  };

  const handleDirectLogin = async () => {
    setLoginError(null);
    const idInput = loginIdInput.trim();
    if (!idInput) {
      setLoginError("아이디를 입력하세요");
      return;
    }
    if (!loginPwInput) {
      setLoginError("비밀번호를 입력하세요");
      return;
    }
    // login_id 컬럼이 없을 수 있어 client-side에서 매칭 (login_id 우선, 없으면 name)
    const target =
      users.find((u) => u.login_id && u.login_id === idInput) ||
      users.find((u) => !u.login_id && u.name === idInput);
    if (!target) {
      setLoginError("아이디 또는 비밀번호가 올바르지 않습니다");
      return;
    }
    if (!target.password_salt || !target.password_hash) {
      setLoginError("이 프로필은 비밀번호가 설정되지 않았습니다");
      return;
    }
    const hash = await hashPassword(loginPwInput, target.password_salt);
    if (hash !== target.password_hash) {
      setLoginError("아이디 또는 비밀번호가 올바르지 않습니다");
      return;
    }
    setCurrentUserId(target.id, rememberLogin);
    if (rememberLogin) addRememberedUser(target.id);
    else removeRememberedUser(target.id);
    onOpenChange(false);
  };

  const handleForgotStart = () => {
    setForgotError(null);
    const idInput = forgotId.trim();
    if (!idInput) {
      setForgotError("아이디를 입력하세요");
      return;
    }
    const target =
      users.find((u) => u.login_id && u.login_id === idInput) ||
      users.find((u) => !u.login_id && u.name === idInput);
    if (!target) {
      setForgotError("아이디를 찾을 수 없습니다");
      return;
    }
    if (
      !target.recovery_question ||
      !target.recovery_answer_hash ||
      !target.recovery_answer_salt
    ) {
      setForgotError(
        "이 프로필은 복구 질문이 설정되지 않았습니다"
      );
      return;
    }
    setForgotTarget(target);
    setForgotStep("answer");
  };

  const handleForgotVerify = async () => {
    setForgotError(null);
    if (!forgotTarget) return;
    if (!forgotAnswer.trim()) {
      setForgotError("답변을 입력하세요");
      return;
    }
    const hash = await hashPassword(
      forgotAnswer.trim().toLowerCase(),
      forgotTarget.recovery_answer_salt!
    );
    if (hash !== forgotTarget.recovery_answer_hash) {
      setForgotError("답변이 일치하지 않습니다");
      return;
    }
    setForgotStep("reset");
  };

  const handleForgotReset = async () => {
    setForgotError(null);
    if (!forgotTarget) return;
    if (!forgotNewPw || forgotNewPw.length < 4) {
      setForgotError("새 비밀번호는 4자 이상");
      return;
    }
    if (forgotNewPw !== forgotNewPwConfirm) {
      setForgotError("비밀번호가 일치하지 않습니다");
      return;
    }
    const salt = generateSalt();
    const hash = await hashPassword(forgotNewPw, salt);
    const { error } = await updateUser(forgotTarget.id, {
      password_hash: hash,
      password_salt: salt,
    });
    if (error) {
      setForgotError("저장 실패");
      return;
    }
    setMode("list");
    setForgotStep("id");
    setForgotId("");
    setForgotAnswer("");
    setForgotNewPw("");
    setForgotNewPwConfirm("");
    setLoginIdInput(forgotTarget.login_id || forgotTarget.name);
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
    setShowPasswordChange(false);
    setPwChangeConfirmOpen(false);
    setPwChangeCurrent("");
    setDeleteConfirmOpen(false);
    setDeletePassword("");
  };

  const handleConfirmPwChange = async () => {
    if (!targetUser) return;
    if (!targetUser.password_salt || !targetUser.password_hash) {
      toast.error("비밀번호가 설정되지 않은 프로필입니다");
      return;
    }
    if (!pwChangeCurrent) {
      toast.error("현재 비밀번호를 입력하세요");
      return;
    }
    const hash = await hashPassword(pwChangeCurrent, targetUser.password_salt);
    if (hash !== targetUser.password_hash) {
      toast.error("비밀번호가 틀렸어요");
      return;
    }
    setPwChangeConfirmOpen(false);
    setPwChangeCurrent("");
    setShowPasswordChange(true);
  };

  const handleConfirmDelete = async () => {
    if (!targetUser) return;
    if (!targetUser.password_salt || !targetUser.password_hash) {
      toast.error("비밀번호가 설정되지 않은 프로필입니다");
      return;
    }
    if (!deletePassword) {
      toast.error("비밀번호를 입력하세요");
      return;
    }
    const hash = await hashPassword(deletePassword, targetUser.password_salt);
    if (hash !== targetUser.password_hash) {
      toast.error("비밀번호가 틀렸어요");
      return;
    }
    await deleteUser(targetUser.id);
    removeRememberedUser(targetUser.id);
    logout();
    setMode("list");
    setDeleteConfirmOpen(false);
    setDeletePassword("");
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
    setMode("list");
  };

  const handleLogout = () => {
    if (currentId) removeRememberedUser(currentId);
    logout();
    setMode("list");
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
            {(mode === "create" || mode === "edit" || mode === "forgot") && (
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
              {mode === "edit" && (targetUser?.id === currentId ? "내 프로필" : `${targetUser?.name} 수정`)}
              {mode === "forgot" && "비밀번호 찾기"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* LIST MODE — 로그인 폼 (사용자 목록 노출 금지) */}
        {mode === "list" && !currentId && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">아이디</Label>
              <Input
                value={loginIdInput}
                onChange={(e) => { setLoginIdInput(e.target.value); setLoginError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleDirectLogin(); }}
                placeholder="영문/숫자"
                autoComplete="username"
                className="h-9"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">비밀번호</Label>
              <Input
                type="password"
                value={loginPwInput}
                onChange={(e) => { setLoginPwInput(e.target.value); setLoginError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleDirectLogin(); }}
                autoComplete="current-password"
                className="h-9"
              />
            </div>
            {loginError && (
              <p className="text-xs text-destructive">{loginError}</p>
            )}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => setRememberLogin(e.target.checked)}
                />
                자동 로그인
              </label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => { setMode("forgot"); setForgotStep("id"); }}
              >
                비밀번호 찾기
              </button>
            </div>
            <Button onClick={handleDirectLogin} className="w-full">
              <LogIn className="mr-1 h-4 w-4" />
              로그인
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={startCreate}
              className="w-full"
            >
              <Plus className="mr-1 h-4 w-4" />
              새 프로필 만들기
            </Button>
          </div>
        )}

        {/* FORGOT MODE */}
        {mode === "forgot" && (
          <div className="flex flex-col gap-3">
            {forgotStep === "id" && (
              <>
                <p className="text-xs text-muted-foreground">
                  복구 질문이 설정된 프로필만 비밀번호를 재설정할 수 있습니다.
                </p>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">아이디</Label>
                  <Input
                    value={forgotId}
                    onChange={(e) => { setForgotId(e.target.value); setForgotError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleForgotStart(); }}
                    placeholder="영문/숫자"
                    className="h-9"
                    autoFocus
                  />
                </div>
                {forgotError && <p className="text-xs text-destructive">{forgotError}</p>}
                <Button onClick={handleForgotStart} className="w-full">다음</Button>
              </>
            )}

            {forgotStep === "answer" && forgotTarget && (
              <>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground mb-1">복구 질문</p>
                  <p className="text-sm font-medium">{forgotTarget.recovery_question}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">답변</Label>
                  <Input
                    value={forgotAnswer}
                    onChange={(e) => { setForgotAnswer(e.target.value); setForgotError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleForgotVerify(); }}
                    placeholder="대소문자 구분 없음"
                    className="h-9"
                    autoFocus
                  />
                </div>
                {forgotError && <p className="text-xs text-destructive">{forgotError}</p>}
                <Button onClick={handleForgotVerify} className="w-full">확인</Button>
              </>
            )}

            {forgotStep === "reset" && (
              <>
                <p className="text-xs text-muted-foreground">
                  새 비밀번호를 설정하세요.
                </p>
                <Input
                  type="password"
                  value={forgotNewPw}
                  onChange={(e) => { setForgotNewPw(e.target.value); setForgotError(null); }}
                  placeholder="새 비밀번호 (4자 이상)"
                  className="h-9"
                  autoFocus
                />
                <Input
                  type="password"
                  value={forgotNewPwConfirm}
                  onChange={(e) => { setForgotNewPwConfirm(e.target.value); setForgotError(null); }}
                  placeholder="비밀번호 확인"
                  className="h-9"
                  onKeyDown={(e) => { if (e.key === "Enter") handleForgotReset(); }}
                />
                {forgotError && <p className="text-xs text-destructive">{forgotError}</p>}
                <Button onClick={handleForgotReset} className="w-full">저장</Button>
              </>
            )}
          </div>
        )}

        {/* CREATE / EDIT MODE */}
        {(mode === "create" || mode === "edit") && (
          <div className="flex flex-col gap-3">
            {mode === "create" ? (
              <>
                {/* 1. 아이디 */}
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">아이디 (영문/숫자/_ 3~20자)</Label>
                  <Input
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="예: hyungseok123"
                    className="h-9"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
                {/* 2. 비밀번호 */}
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">비밀번호</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 (4자 이상)"
                    className="h-9"
                    autoComplete="new-password"
                  />
                  <Input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 확인"
                    className="h-9"
                    autoComplete="new-password"
                  />
                </div>
                {/* 2-b. 복구 질문/답변 (선택) — 비번 찾기용 */}
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    비밀번호 찾기 (선택) — 복구 질문 / 답변
                  </Label>
                  <Input
                    value={recoveryQuestion}
                    onChange={(e) => setRecoveryQuestion(e.target.value)}
                    placeholder="예: 어머니 성함은?"
                    className="h-9 text-xs"
                  />
                  <Input
                    value={recoveryAnswer}
                    onChange={(e) => setRecoveryAnswer(e.target.value)}
                    placeholder="답변 (대소문자 무시)"
                    className="h-9 text-xs"
                  />
                </div>
                {/* 3. 이름 */}
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">이름 (표시용)</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="이름"
                    className="h-9"
                  />
                </div>
                {/* 4. 프로필 이미지 미리보기 */}
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
              </>
            ) : (
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
            )}

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

            {/* 비밀번호 변경 — 편집 모드에서 토글 시에만 표시 (create는 위에서 입력) */}
            {mode === "edit" && showPasswordChange && (
              <div className="flex flex-col gap-1 pt-2 border-t">
                <Label className="text-[10px] text-muted-foreground">
                  새 비밀번호
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 (4자 이상)"
                  className="h-9"
                />
                <Input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호 확인"
                  className="h-9"
                />
              </div>
            )}

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

            {/* 편집 + 자기 프로필일 때만 액션 그리드 */}
            {mode === "edit" && targetUser && targetUser.id === currentId && (
              <div className="border-t pt-3 mt-1 flex flex-col gap-2">
                {pwChangeConfirmOpen ? (
                  <div className="flex flex-col gap-2 rounded-lg border p-3 bg-muted/30">
                    <p className="text-xs font-medium">🔒 비밀번호 변경 — 현재 비밀번호 확인</p>
                    <Input
                      type="password"
                      value={pwChangeCurrent}
                      onChange={(e) => setPwChangeCurrent(e.target.value)}
                      placeholder="현재 비밀번호"
                      className="h-8"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") handleConfirmPwChange(); }}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => { setPwChangeConfirmOpen(false); setPwChangeCurrent(""); }}>
                        취소
                      </Button>
                      <Button type="button" size="sm" className="h-7 text-xs" onClick={handleConfirmPwChange}>
                        확인
                      </Button>
                    </div>
                  </div>
                ) : deleteConfirmOpen ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    <p className="text-xs text-destructive font-medium">
                      ⚠️ 프로필 삭제 — 비밀번호로 확인
                    </p>
                    <Input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="비밀번호"
                      className="h-8"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDelete(); }}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => { setDeleteConfirmOpen(false); setDeletePassword(""); }}>
                        취소
                      </Button>
                      <Button type="button" size="sm"
                        className="h-7 text-xs bg-destructive hover:bg-destructive/90"
                        onClick={handleConfirmDelete}>
                        확인 후 삭제
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
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
                      onClick={handleLogout}
                      className="flex items-center justify-center gap-2 rounded-md border p-2.5 text-xs hover:bg-accent transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                      로그아웃
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (showPasswordChange) {
                          setShowPasswordChange(false);
                          setPassword("");
                          setPasswordConfirm("");
                        } else {
                          setPwChangeConfirmOpen(true);
                        }
                      }}
                      className="flex items-center justify-center gap-2 rounded-md border p-2.5 text-xs hover:bg-accent transition-colors"
                    >
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      비밀번호 변경
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="flex items-center justify-center gap-2 rounded-md border border-destructive/30 p-2.5 text-xs text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      프로필 삭제
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
      <ShareManager open={shareOpen} onOpenChange={setShareOpen} />
    </Dialog>
  );
}

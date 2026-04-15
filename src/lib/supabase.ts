import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

// 자동 로그인 여부 플래그 — 로그인 시 UserSwitcher가 설정.
// true  → localStorage에 세션 저장 (브라우저/PWA 재시작 후에도 유지)
// false → sessionStorage에 저장 (탭/앱 닫으면 로그아웃)
const REMEMBER_KEY = "auth_remember_me";

function getRemember(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(REMEMBER_KEY);
  return v !== "false"; // 기본값 true
}

export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
}

// 요청 시점에 플래그를 읽어 적절한 스토리지로 라우팅
const hybridStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    const remember = getRemember();
    return remember ? localStorage.getItem(key) : sessionStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    const remember = getRemember();
    if (remember) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: hybridStorage,
  },
});

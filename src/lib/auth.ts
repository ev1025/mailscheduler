"use client";

// SHA-256 (salt + password) 해시. 개인용 2~3명 앱 수준 보안.
export async function hashPassword(
  password: string,
  salt: string
): Promise<string> {
  const data = new TextEncoder().encode(salt + password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// localStorage 세션 키
const REMEMBER_KEY = "auth_remember";
const SESSION_KEY = "auth_session_user"; // 세션(탭 닫으면 사라짐)

/**
 * 자동 로그인 설정.
 *  - remember=true: current_user_id는 localStorage에 영구 저장 (기존 동작)
 *  - remember=false: sessionStorage에 저장, 탭 닫으면 로그아웃
 */
export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, "1");
  } else {
    localStorage.removeItem(REMEMBER_KEY);
  }
}

export function getRememberMe(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(REMEMBER_KEY) === "1";
}

export function saveSessionUser(userId: string | null) {
  if (typeof window === "undefined") return;
  if (userId) sessionStorage.setItem(SESSION_KEY, userId);
  else sessionStorage.removeItem(SESSION_KEY);
}

export function getSessionUser(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SESSION_KEY);
}

/**
 * 앱 시작 시 호출해서 유효한 user_id를 결정.
 *  - remember=true이면 localStorage의 current_user_id 사용
 *  - remember=false이면 sessionStorage의 auth_session_user 사용
 */
export function resolveActiveUser(): string | null {
  if (typeof window === "undefined") return null;
  if (getRememberMe()) {
    return localStorage.getItem("current_user_id");
  }
  return getSessionUser();
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("current_user_id");
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

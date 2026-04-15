"use client";

// SHA-256 (salt + password) 해시. 개인용 2~3명 앱 수준 보안.
// ※ 2026 기준 프로덕션용으로는 약함. argon2id/scrypt 이관 예정.
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

/**
 * 저장된 해시와 입력 비밀번호가 일치하는지 비교.
 * salt 또는 hash가 없으면 false.
 */
export async function verifyPassword(
  input: string,
  salt: string | null | undefined,
  expectedHash: string | null | undefined
): Promise<boolean> {
  if (!salt || !expectedHash) return false;
  const hash = await hashPassword(input, salt);
  return hash === expectedHash;
}

/**
 * 새 비밀번호(또는 복구 답변)에 대해 salt + hash 한 쌍을 생성.
 * 답변은 대소문자 무시해야 할 때 호출 전에 trim().toLowerCase() 처리.
 */
export async function hashWithNewSalt(plain: string): Promise<{ hash: string; salt: string }> {
  const salt = generateSalt();
  const hash = await hashPassword(plain, salt);
  return { hash, salt };
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

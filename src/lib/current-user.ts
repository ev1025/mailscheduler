"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface AppUser {
  id: string;
  name: string;
  login_id?: string | null; // 영문/숫자 로그인 ID (없으면 name으로 폴백)
  color: string;
  emoji: string | null;
  avatar_url: string | null;
  password_hash?: string | null;
  password_salt?: string | null;
  recovery_question?: string | null;
  recovery_answer_hash?: string | null;
  recovery_answer_salt?: string | null;
  created_at: string;
}

const STORAGE_KEY = "current_user_id";
const SESSION_KEY = "auth_session_user";
const REMEMBER_KEY = "auth_remember";
const REMEMBERED_USERS_KEY = "remembered_users";
const LOCAL_USERS_KEY = "app_users_local";

// 이 기기에서 자동 로그인 허용된 프로필 id 목록
export function getRememberedUsers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REMEMBERED_USERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addRememberedUser(id: string) {
  if (typeof window === "undefined") return;
  const set = new Set(getRememberedUsers());
  set.add(id);
  localStorage.setItem(REMEMBERED_USERS_KEY, JSON.stringify(Array.from(set)));
}

export function removeRememberedUser(id: string) {
  if (typeof window === "undefined") return;
  const next = getRememberedUsers().filter((x) => x !== id);
  localStorage.setItem(REMEMBERED_USERS_KEY, JSON.stringify(next));
}

export function isRemembered(id: string): boolean {
  return getRememberedUsers().includes(id);
}

type Listener = (id: string | null) => void;
const listeners = new Set<Listener>();

function rememberOn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(REMEMBER_KEY) === "1";
}

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  // remember 체크되면 localStorage, 아니면 sessionStorage
  if (rememberOn()) {
    return localStorage.getItem(STORAGE_KEY);
  }
  return sessionStorage.getItem(SESSION_KEY);
}

export function setCurrentUserId(id: string | null, remember?: boolean) {
  if (typeof window === "undefined") return;
  if (remember !== undefined) {
    if (remember) localStorage.setItem(REMEMBER_KEY, "1");
    else localStorage.removeItem(REMEMBER_KEY);
  }
  // 양쪽 모두 정리
  if (!id) {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    if (rememberOn()) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      sessionStorage.setItem(SESSION_KEY, id);
    }
  }
  listeners.forEach((l) => l(id));
}

export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  listeners.forEach((l) => l(null));
}

export function onCurrentUserChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCurrentUserId() {
  const [id, setId] = useState<string | null>(() => getCurrentUserId());
  useEffect(() => {
    // 탭 간 동기화
    const handler = () => setId(getCurrentUserId());
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("storage", handler);
    };
  }, []);
  useEffect(() => {
    return onCurrentUserChange((next) => setId(next));
  }, []);
  return id;
}

// --- localStorage fallback (when app_users table doesn't exist yet) ---
function loadLocalUsers(): AppUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalUsers(users: AppUser[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function generateLocalId() {
  return "local_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function useAppUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [useLocal, setUseLocal] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .order("created_at");
    if (error || !data) {
      // Supabase 테이블 없음 → localStorage fallback
      setUseLocal(true);
      setUsers(loadLocalUsers());
    } else {
      setUseLocal(false);
      setUsers(data as AppUser[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const addUser = async (
    name: string,
    color: string,
    emoji?: string,
    avatarUrl?: string,
    passwordHash?: string,
    passwordSalt?: string,
    loginId?: string,
    recoveryQuestion?: string,
    recoveryAnswerHash?: string,
    recoveryAnswerSalt?: string
  ) => {
    const fullPayload: Record<string, unknown> = {
      name,
      login_id: loginId || null,
      color,
      emoji: emoji || null,
      avatar_url: avatarUrl || null,
      password_hash: passwordHash || null,
      password_salt: passwordSalt || null,
      recovery_question: recoveryQuestion || null,
      recovery_answer_hash: recoveryAnswerHash || null,
      recovery_answer_salt: recoveryAnswerSalt || null,
    };
    const { data, error } = await supabase
      .from("app_users")
      .insert(fullPayload)
      .select()
      .single();
    if (error || !data) {
      // 비밀번호가 있는데 저장 실패 → password 컬럼이 없는 상황. 명확히 거부
      if (passwordHash) {
        return {
          data: null,
          error:
            "비밀번호 저장 실패: Supabase SQL Editor에서 supabase-v2-auth.sql을 먼저 실행하세요",
        };
      }
      // password 컬럼 없을 때 재시도 (avatar_url만)
      const { data: retryData, error: retryErr } = await supabase
        .from("app_users")
        .insert({
          name,
          color,
          emoji: emoji || null,
          avatar_url: avatarUrl || null,
        })
        .select()
        .single();
      if (retryErr || !retryData) {
        // 완전 fallback: emoji만
        const { data: r2, error: e2 } = await supabase
          .from("app_users")
          .insert({ name, color, emoji: emoji || null })
          .select()
          .single();
        if (e2 || !r2) {
          // localStorage fallback
          const newUser: AppUser = {
            id: generateLocalId(),
            name,
            color,
            emoji: emoji || null,
            avatar_url: avatarUrl || null,
            password_hash: passwordHash || null,
            password_salt: passwordSalt || null,
            created_at: new Date().toISOString(),
          };
          const next = [...loadLocalUsers(), newUser];
          saveLocalUsers(next);
          setUsers(next);
          setUseLocal(true);
          return { data: newUser, error: null };
        }
        await fetchUsers();
        return { data: r2 as AppUser, error: null };
      }
      await fetchUsers();
      return { data: retryData as AppUser, error: null };
    }
    await fetchUsers();
    return { data: data as AppUser, error: null };
  };

  const updateUser = async (id: string, updates: Partial<AppUser>) => {
    if (id.startsWith("local_") || useLocal) {
      const next = loadLocalUsers().map((u) =>
        u.id === id ? { ...u, ...updates } : u
      );
      saveLocalUsers(next);
      setUsers(next);
      return { error: null };
    }
    // 1차: 전체 컬럼으로 시도
    let { error } = await supabase
      .from("app_users")
      .update(updates)
      .eq("id", id);
    if (error) {
      // 2차: avatar_url 컬럼이 없을 가능성 → 빼고 재시도
      if (
        error.message?.includes("avatar_url") ||
        error.message?.includes("column")
      ) {
        const { avatar_url, ...rest } = updates;
        void avatar_url;
        ({ error } = await supabase
          .from("app_users")
          .update(rest)
          .eq("id", id));
      }
    }
    if (error) {
      // 3차: password 컬럼 없는 경우
      if (
        (updates.password_hash || updates.password_salt) &&
        (error.message?.includes("password") ||
          error.message?.includes("column"))
      ) {
        return {
          error: "비밀번호 저장 실패: supabase-v2-auth.sql을 실행하세요",
        };
      }
      return { error: error.message || String(error) };
    }
    await fetchUsers();
    return { error: null };
  };

  const deleteUser = async (id: string) => {
    if (id.startsWith("local_") || useLocal) {
      const next = loadLocalUsers().filter((u) => u.id !== id);
      saveLocalUsers(next);
      setUsers(next);
      return { error: null };
    }
    const { error } = await supabase.from("app_users").delete().eq("id", id);
    if (!error) await fetchUsers();
    return { error };
  };

  return {
    users,
    loading,
    useLocal,
    addUser,
    updateUser,
    deleteUser,
    refetch: fetchUsers,
  };
}

export function useCurrentUser() {
  const id = useCurrentUserId();
  const { users } = useAppUsers();
  return users.find((u) => u.id === id) || null;
}

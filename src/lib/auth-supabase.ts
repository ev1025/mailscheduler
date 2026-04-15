"use client";

// Supabase Auth (이메일 매직링크) 래퍼.
// 앱 전역에서 Supabase Auth를 직접 import하지 않고 이 파일을 거쳐 사용한다.
// → 나중에 Auth 이전이 끝나면 lib/current-user.ts의 커스텀 세션 로직과 병합/제거.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

/**
 * 이메일로 매직링크 발송.
 * - shouldCreateUser=true: 해당 이메일이 auth.users에 없으면 자동 생성
 * - emailRedirectTo: 링크 클릭 후 돌아올 URL (Supabase URL Configuration에 등록돼 있어야 함)
 */
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "이메일을 입력하세요" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { error: "이메일 형식이 올바르지 않습니다" };
  }
  const emailRedirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      shouldCreateUser: true,
      emailRedirectTo,
    },
  });
  if (error) return { error: error.message };
  return { error: null };
}

/** 현재 Supabase Auth 세션 조회 (초기화용). */
export async function getAuthSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** 로그아웃 — auth.users 세션 종료 + 로컬 storage 정리. */
export async function supabaseSignOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Supabase Auth 세션을 React 상태로 구독.
 * onAuthStateChange에 연결해서 매직링크 돌아올 때 바로 반영.
 */
export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const s = await getAuthSession();
      if (active) {
        setSession(s);
        setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

/** 현재 Auth 사용자의 UUID만 필요할 때. */
export function useAuthUserId(): string | null {
  const { user } = useSupabaseAuth();
  return user?.id ?? null;
}

export type { Session, User };

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/lib/auth-supabase";

export interface AppUser {
  id: string;
  name: string;
  auth_user_id?: string | null; // Supabase auth.users 연결
  color: string;
  emoji: string | null;
  avatar_url: string | null;
  created_at: string;
}

/**
 * app_users 테이블 관리 훅.
 * Supabase Auth 이전 후 단순화 — 비밀번호/login_id 관련 필드 제거.
 */
export function useAppUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .order("created_at");
    if (!error && data) setUsers(data as AppUser[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /**
   * 새 프로필 생성. 이메일 로그인 직후 처음 접속할 때 호출.
   * auth_user_id로 Supabase Auth 사용자와 연결.
   */
  const addUser = async (
    authUserId: string,
    name: string,
    color: string,
    emoji?: string,
    avatarUrl?: string
  ) => {
    const payload = {
      auth_user_id: authUserId,
      name,
      color,
      emoji: emoji || null,
      avatar_url: avatarUrl || null,
    };
    const { data, error } = await supabase
      .from("app_users")
      .insert(payload)
      .select()
      .single();
    if (error || !data) {
      return { data: null, error: error?.message || "프로필 생성 실패" };
    }
    await fetchUsers();
    return { data: data as AppUser, error: null };
  };

  const updateUser = async (id: string, updates: Partial<AppUser>) => {
    const { error } = await supabase
      .from("app_users")
      .update(updates)
      .eq("id", id);
    if (error) return { error: error.message };
    await fetchUsers();
    return { error: null };
  };

  const deleteUser = async (id: string) => {
    const { error } = await supabase.from("app_users").delete().eq("id", id);
    if (!error) await fetchUsers();
    return { error };
  };

  return {
    users,
    loading,
    addUser,
    updateUser,
    deleteUser,
    refetch: fetchUsers,
  };
}

/**
 * 현재 로그인한 사용자의 app_users.id 반환.
 * Supabase Auth 세션의 auth.uid()를 받아서 app_users의 row id로 변환.
 * 세션이 없거나 app_users에 연결된 row가 없으면 null.
 */
export function useCurrentUserId(): string | null {
  const { user } = useSupabaseAuth();
  const { users } = useAppUsers();
  return useMemo(() => {
    if (!user) return null;
    const row = users.find((u) => u.auth_user_id === user.id);
    return row?.id ?? null;
  }, [user, users]);
}

/** 현재 로그인한 사용자의 app_users 레코드 전체 반환. */
export function useCurrentUser(): AppUser | null {
  const { user } = useSupabaseAuth();
  const { users } = useAppUsers();
  return useMemo(() => {
    if (!user) return null;
    return users.find((u) => u.auth_user_id === user.id) ?? null;
  }, [user, users]);
}

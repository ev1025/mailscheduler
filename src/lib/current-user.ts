"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface AppUser {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  avatar_url: string | null;
  created_at: string;
}

const STORAGE_KEY = "current_user_id";
const LOCAL_USERS_KEY = "app_users_local";

type Listener = (id: string | null) => void;
const listeners = new Set<Listener>();

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setCurrentUserId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((l) => l(id));
}

export function onCurrentUserChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCurrentUserId() {
  const [id, setId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
  );
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
    avatarUrl?: string
  ) => {
    const payload: Record<string, unknown> = {
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
      // avatar_url 컬럼 없을 때 재시도
      const { data: retryData, error: retryErr } = await supabase
        .from("app_users")
        .insert({ name, color, emoji: emoji || null })
        .select()
        .single();
      if (retryErr || !retryData) {
        // Fallback: localStorage
        const newUser: AppUser = {
          id: generateLocalId(),
          name,
          color,
          emoji: emoji || null,
          avatar_url: avatarUrl || null,
          created_at: new Date().toISOString(),
        };
        const next = [...loadLocalUsers(), newUser];
        saveLocalUsers(next);
        setUsers(next);
        setUseLocal(true);
        return { data: newUser, error: null };
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
    const { error } = await supabase
      .from("app_users")
      .update(updates)
      .eq("id", id);
    if (!error) await fetchUsers();
    return { error };
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface AppUser {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  created_at: string;
}

const STORAGE_KEY = "current_user_id";

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

  const addUser = async (name: string, color: string, emoji?: string) => {
    const { data, error } = await supabase
      .from("app_users")
      .insert({ name, color, emoji: emoji || null })
      .select()
      .single();
    if (!error) await fetchUsers();
    return { data: data as AppUser | null, error };
  };

  const updateUser = async (id: string, updates: Partial<AppUser>) => {
    const { error } = await supabase
      .from("app_users")
      .update(updates)
      .eq("id", id);
    if (!error) await fetchUsers();
    return { error };
  };

  const deleteUser = async (id: string) => {
    const { error } = await supabase.from("app_users").delete().eq("id", id);
    if (!error) await fetchUsers();
    return { error };
  };

  return { users, loading, addUser, updateUser, deleteUser, refetch: fetchUsers };
}

export function useCurrentUser() {
  const id = useCurrentUserId();
  const { users } = useAppUsers();
  return users.find((u) => u.id === id) || null;
}

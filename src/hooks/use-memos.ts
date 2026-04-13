"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Memo } from "@/types";
import { useCurrentUserId } from "@/lib/current-user";

export function useMemos() {
  const userId = useCurrentUserId();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemos = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("memos")
      .select("*")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;

    if (error) {
      // user_id 컬럼 없는 경우 fallback
      const fallback = await supabase
        .from("memos")
        .select("*")
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (fallback.data) setMemos(fallback.data);
    } else if (data) {
      setMemos(data);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchMemos();
  }, [fetchMemos]);

  const addMemo = async (title: string, content: string) => {
    const { error } = await supabase
      .from("memos")
      .insert({ title, content, user_id: userId });
    if (error) {
      const retry = await supabase.from("memos").insert({ title, content });
      if (!retry.error) await fetchMemos();
      return { error: retry.error };
    }
    await fetchMemos();
    return { error: null };
  };

  const updateMemo = async (
    id: string,
    updates: Partial<Pick<Memo, "title" | "content" | "pinned">>
  ) => {
    const { error } = await supabase
      .from("memos")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) await fetchMemos();
    return { error };
  };

  const deleteMemo = async (id: string) => {
    const { error } = await supabase.from("memos").delete().eq("id", id);
    if (!error) await fetchMemos();
    return { error };
  };

  const togglePin = async (id: string, currentPinned: boolean) => {
    return updateMemo(id, { pinned: !currentPinned });
  };

  return {
    memos,
    loading,
    addMemo,
    updateMemo,
    deleteMemo,
    togglePin,
    refetch: fetchMemos,
  };
}

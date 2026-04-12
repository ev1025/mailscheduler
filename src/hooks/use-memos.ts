"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Memo } from "@/types";

export function useMemos() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("memos")
      .select("*")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (!error && data) setMemos(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMemos();
  }, [fetchMemos]);

  const addMemo = async (title: string, content: string) => {
    const { error } = await supabase
      .from("memos")
      .insert({ title, content });
    if (!error) await fetchMemos();
    return { error };
  };

  const updateMemo = async (id: string, updates: Partial<Pick<Memo, "title" | "content" | "pinned">>) => {
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

  return { memos, loading, addMemo, updateMemo, deleteMemo, togglePin, refetch: fetchMemos };
}

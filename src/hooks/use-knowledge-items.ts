"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUserId } from "@/lib/current-user";
import type { KnowledgeItem } from "@/types";

export function useKnowledgeItems(folderId: string | null) {
  const userId = useCurrentUserId();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("knowledge_items")
      .select("*")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    if (folderId) query = query.eq("folder_id", folderId);
    const { data, error } = await query;
    if (!error && data) setItems(data as KnowledgeItem[]);
    setLoading(false);
  }, [folderId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = async (
    item: Omit<KnowledgeItem, "id" | "created_at" | "updated_at">
  ) => {
    if (!userId) return { data: null, error: "로그인이 필요합니다" };
    const { data, error } = await supabase
      .from("knowledge_items")
      .insert({
        ...item,
        excerpt: item.content ? item.content.slice(0, 200) : null,
        user_id: userId,
      })
      .select()
      .single();
    if (!error) await fetchItems();
    return { data: data as KnowledgeItem | null, error };
  };

  const updateItem = async (id: string, updates: Partial<KnowledgeItem>) => {
    const patch: Partial<KnowledgeItem> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    if (updates.content !== undefined) {
      patch.excerpt = updates.content ? updates.content.slice(0, 200) : null;
    }
    const { error } = await supabase
      .from("knowledge_items")
      .update(patch)
      .eq("id", id);
    if (!error) await fetchItems();
    return { error };
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase
      .from("knowledge_items")
      .delete()
      .eq("id", id);
    if (!error) await fetchItems();
    return { error };
  };

  return {
    items,
    loading,
    addItem,
    updateItem,
    deleteItem,
    refetch: fetchItems,
  };
}

export async function searchKnowledge(query: string): Promise<KnowledgeItem[]> {
  if (!query.trim()) return [];
  const q = query.trim();
  const { data, error } = await supabase
    .from("knowledge_items")
    .select("*")
    .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return data as KnowledgeItem[];
}

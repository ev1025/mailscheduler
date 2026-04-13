"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { KnowledgeFolder } from "@/types";

export function useKnowledgeFolders() {
  const [folders, setFolders] = useState<KnowledgeFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_folders")
      .select("*")
      .order("sort_order")
      .order("name");
    if (!error && data) setFolders(data as KnowledgeFolder[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const addFolder = async (
    name: string,
    icon?: string,
    parentId?: string | null
  ) => {
    const { data, error } = await supabase
      .from("knowledge_folders")
      .insert({
        name,
        icon: icon || null,
        parent_id: parentId || null,
        sort_order: folders.length,
      })
      .select()
      .single();
    if (!error) await fetchFolders();
    return { data: data as KnowledgeFolder | null, error };
  };

  const updateFolder = async (id: string, updates: Partial<KnowledgeFolder>) => {
    const { error } = await supabase
      .from("knowledge_folders")
      .update(updates)
      .eq("id", id);
    if (!error) await fetchFolders();
    return { error };
  };

  const deleteFolder = async (id: string) => {
    const { error } = await supabase
      .from("knowledge_folders")
      .delete()
      .eq("id", id);
    if (!error) await fetchFolders();
    return { error };
  };

  const reorderFolders = async (ids: string[]) => {
    await Promise.all(
      ids.map((id, i) =>
        supabase
          .from("knowledge_folders")
          .update({ sort_order: i })
          .eq("id", id)
      )
    );
    await fetchFolders();
  };

  return {
    folders,
    loading,
    addFolder,
    updateFolder,
    deleteFolder,
    reorderFolders,
    refetch: fetchFolders,
  };
}

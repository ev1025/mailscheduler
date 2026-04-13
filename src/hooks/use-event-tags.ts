"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EventTag } from "@/types";
import { useCurrentUserId } from "@/lib/current-user";

export function useEventTags() {
  const userId = useCurrentUserId();
  const [tags, setTags] = useState<EventTag[]>([]);

  const fetchTags = useCallback(async () => {
    let query = supabase.from("event_tags").select("*").order("name");
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) {
      const fallback = await supabase.from("event_tags").select("*").order("name");
      if (fallback.data) setTags(fallback.data);
    } else if (data) {
      setTags(data);
    }
  }, [userId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const addTag = async (name: string, color: string) => {
    const { error } = await supabase
      .from("event_tags")
      .insert({ name: name.trim(), color, user_id: userId });
    if (error) {
      const retry = await supabase
        .from("event_tags")
        .insert({ name: name.trim(), color });
      if (!retry.error) await fetchTags();
      return { error: retry.error };
    }
    await fetchTags();
    return { error: null };
  };

  const deleteTag = async (id: string) => {
    const { error } = await supabase.from("event_tags").delete().eq("id", id);
    if (!error) await fetchTags();
    return { error };
  };

  const updateTagColor = async (id: string, color: string) => {
    const { error } = await supabase.from("event_tags").update({ color }).eq("id", id);
    if (!error) await fetchTags();
    return { error };
  };

  return { tags, addTag, deleteTag, updateTagColor, refetch: fetchTags };
}

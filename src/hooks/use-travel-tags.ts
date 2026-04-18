"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUserId } from "@/lib/current-user";
import type { TravelTag } from "@/types";

export function useTravelTags() {
  const userId = useCurrentUserId();
  const [tags, setTags] = useState<TravelTag[]>([]);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from("travel_tags").select("*").order("name");
    if (data) setTags(data);
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const addTag = async (name: string, color: string) => {
    if (!userId) return { error: "로그인이 필요합니다" };
    const { error } = await supabase
      .from("travel_tags")
      .insert({ name: name.trim(), color, user_id: userId });
    if (!error) await fetchTags();
    return { error };
  };

  const deleteTag = async (id: string) => {
    const { error } = await supabase.from("travel_tags").delete().eq("id", id);
    if (!error) await fetchTags();
    return { error };
  };

  const updateTagColor = async (id: string, color: string) => {
    const { error } = await supabase.from("travel_tags").update({ color }).eq("id", id);
    if (!error) await fetchTags();
    return { error };
  };

  const updateTagName = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: "empty" };
    const { error } = await supabase.from("travel_tags").update({ name: trimmed }).eq("id", id);
    if (!error) await fetchTags();
    return { error };
  };

  return { tags, addTag, deleteTag, updateTagColor, updateTagName, refetch: fetchTags };
}

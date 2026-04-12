"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EventTag } from "@/types";

export function useEventTags() {
  const [tags, setTags] = useState<EventTag[]>([]);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase
      .from("event_tags")
      .select("*")
      .order("name");
    if (data) setTags(data);
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const addTag = async (name: string, color: string) => {
    const { error } = await supabase
      .from("event_tags")
      .insert({ name: name.trim(), color });
    if (!error) await fetchTags();
    return { error };
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

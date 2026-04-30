"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUserId } from "@/lib/current-user";
import type { TravelTag } from "@/types";

/**
 * 여행 태그 훅. visibleUserIds 가 주어지면 그 사용자들의 태그까지 같이 가져옴
 * (공유받은 owner 의 태그 색 표시용). RLS 가 "Read own or shared" 로 풀려 있어
 * 공유 행도 반환되는 전제.
 */
export function useTravelTags(visibleUserIds?: string[]) {
  const userId = useCurrentUserId();
  const [tags, setTags] = useState<TravelTag[]>([]);

  const idsKey = (visibleUserIds && visibleUserIds.length > 0
    ? [...visibleUserIds].sort().join(",")
    : userId ?? "");

  const fetchTags = useCallback(async () => {
    let query = supabase.from("travel_tags").select("*").order("name");
    if (visibleUserIds && visibleUserIds.length > 0) {
      query = query.in("user_id", visibleUserIds);
    } else if (userId) {
      // 명시적 본인 필터. RLS 도 own/shared 로 막아주지만 클라에서도 한 번 더.
      query = query.eq("user_id", userId);
    }
    const { data } = await query;
    if (data) setTags(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

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

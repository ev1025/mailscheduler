"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EventTag } from "@/types";
import { useCurrentUserId } from "@/lib/current-user";

/**
 * 일정 태그 훅.
 *
 * visibleUserIds 를 넘기면 그 사용자들 (보통 "내" + "공유받은 owner") 의 태그를
 * 모두 가져온다. 이전엔 본인 user_id 만 필터해서, 공유 상대 입장에서 owner 의
 * 일정에 붙은 태그가 색을 잃고 회색으로 표시되던 버그가 있었음.
 *
 * RLS 가 "Read own or shared" 로 열려 있어야 (supabase-rls-event-tags-shared.sql)
 * 공유 owner 의 행이 실제로 반환됨.
 */
export function useEventTags(visibleUserIds?: string[]) {
  const userId = useCurrentUserId();
  const [tags, setTags] = useState<EventTag[]>([]);

  // visibleUserIds 가 주어지면 그 set, 아니면 본인 user_id 만.
  // 캐시 키로 직렬화해서 useCallback deps 안정화.
  const idsKey = (visibleUserIds && visibleUserIds.length > 0
    ? [...visibleUserIds].sort().join(",")
    : userId ?? "");

  const fetchTags = useCallback(async () => {
    let query = supabase.from("event_tags").select("*").order("name");
    if (visibleUserIds && visibleUserIds.length > 0) {
      query = query.in("user_id", visibleUserIds);
    } else if (userId) {
      query = query.eq("user_id", userId);
    }
    const { data, error } = await query;
    if (error) {
      // RLS 허용 안 하는 구 환경 폴백 — 본인 것만이라도.
      const fallback = await supabase.from("event_tags").select("*").order("name");
      if (fallback.data) setTags(fallback.data);
    } else if (data) {
      setTags(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

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

  const updateTagName = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: "empty" };
    const { error } = await supabase.from("event_tags").update({ name: trimmed }).eq("id", id);
    if (!error) await fetchTags();
    return { error };
  };

  return { tags, addTag, deleteTag, updateTagColor, updateTagName, refetch: fetchTags };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TravelItem } from "@/types";
import { useCurrentUserId } from "@/lib/current-user";

/**
 * visibleUserIds: 달력 탭에서 선택한 "볼 사용자들"
 *  - 전달 시 해당 사용자들의 여행 항목만 조회 (공유된 여행 포함)
 *  - 생략 시 내 항목만
 */
export function useTravelItems(visibleUserIds?: string[]) {
  const userId = useCurrentUserId();
  const [items, setItems] = useState<TravelItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 의존성 안정화를 위해 join한 문자열 사용
  const visibleKey = visibleUserIds?.join(",") ?? "";

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("travel_items")
      .select("*")
      .order("visited")
      .order("created_at", { ascending: false });
    const filterIds = visibleUserIds && visibleUserIds.length > 0
      ? visibleUserIds
      : (userId ? [userId] : []);
    if (filterIds.length > 0) query = query.in("user_id", filterIds);
    const { data, error } = await query;
    if (error) {
      // user_id 컬럼이 없는 구버전 테이블 대비 fallback
      const fallback = await supabase
        .from("travel_items")
        .select("*")
        .order("visited")
        .order("created_at", { ascending: false });
      if (fallback.data) setItems(fallback.data);
    } else if (data) {
      setItems(data);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, visibleKey]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // month/color/visited_dates 컬럼이 없을 수 있어 fallback 처리
  const addItem = async (item: Omit<TravelItem, "id" | "created_at" | "updated_at">) => {
    const { error } = await supabase
      .from("travel_items")
      .insert({ ...item, user_id: userId });
    if (error) {
      const { month, color, visited_dates, place_name, address, lat, lng, places, ...rest } = item;
      void month; void color; void visited_dates; void place_name; void address; void lat; void lng; void places;
      const { error: retry } = await supabase.from("travel_items").insert(rest);
      if (!retry) await fetchItems();
      return { error: retry };
    }
    await fetchItems();
    return { error: null };
  };

  const updateItem = async (id: string, updates: Partial<Omit<TravelItem, "id" | "created_at">>) => {
    const { error } = await supabase
      .from("travel_items")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.warn("[travel_items update] 1차 실패:", error.message, error.code);
      // DB 에 아직 없을 수 있는 컬럼 모두 제거 후 재시도.
      // (마이그레이션이 빠진 환경 대응)
      const {
        month, color, visited_dates, place_name, address, lat, lng,
        mood, price_tier, rating, couple_notes, cover_image_url,
        places,
        ...rest
      } = updates;
      void month; void color; void visited_dates; void place_name; void address; void lat; void lng;
      void mood; void price_tier; void rating; void couple_notes; void cover_image_url; void places;
      const { error: retry } = await supabase
        .from("travel_items")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (retry) {
        console.warn("[travel_items update] 2차 실패:", retry.message, retry.code);
      } else {
        await fetchItems();
      }
      return { error: retry };
    }
    await fetchItems();
    return { error: null };
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("travel_items").delete().eq("id", id);
    if (!error) await fetchItems();
    return { error };
  };

  const toggleVisited = async (id: string, visited: boolean) => {
    return updateItem(id, { visited: !visited });
  };

  return { items, loading, addItem, updateItem, deleteItem, toggleVisited, refetch: fetchItems };
}

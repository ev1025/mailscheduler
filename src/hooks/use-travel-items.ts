"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TravelItem } from "@/types";
import { useCurrentUserId } from "@/lib/current-user";

export function useTravelItems() {
  const userId = useCurrentUserId();
  const [items, setItems] = useState<TravelItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("travel_items")
      .select("*")
      .order("visited")
      .order("created_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) {
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
  }, [userId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // month/color/visited_dates 컬럼이 없을 수 있어 fallback 처리
  const addItem = async (item: Omit<TravelItem, "id" | "created_at" | "updated_at">) => {
    const { error } = await supabase
      .from("travel_items")
      .insert({ ...item, user_id: userId });
    if (error) {
      const { month, color, visited_dates, ...rest } = item;
      void month; void color; void visited_dates;
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
      const { month, color, visited_dates, ...rest } = updates;
      void month; void color; void visited_dates;
      const { error: retry } = await supabase
        .from("travel_items")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (!retry) await fetchItems();
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

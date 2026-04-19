"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUserId } from "@/lib/current-user";
import type { TravelPlan } from "@/types";

// 여행 계획(travel_plans) CRUD 훅. 개인 앱이지만 user_id 필드로 향후 공유 대비.
export function useTravelPlans() {
  const userId = useCurrentUserId();
  const [plans, setPlans] = useState<TravelPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("travel_plans")
      .select("*")
      .order("updated_at", { ascending: false });
    if (userId) query = query.in("user_id", [userId]);
    const { data, error } = await query;
    if (error) {
      // user_id 컬럼이 없는 구버전 대비
      const fallback = await supabase
        .from("travel_plans")
        .select("*")
        .order("updated_at", { ascending: false });
      if (fallback.data) setPlans(fallback.data);
    } else if (data) {
      setPlans(data);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const addPlan = async (
    input: Pick<TravelPlan, "title"> & Partial<Pick<TravelPlan, "start_date" | "end_date" | "notes">>
  ) => {
    // 1차 시도: user_id 포함
    const payload = { ...input, user_id: userId };
    const first = await supabase
      .from("travel_plans")
      .insert(payload)
      .select("*")
      .single();
    if (!first.error) {
      await fetchPlans();
      return { data: first.data, error: null };
    }
    // 2차 fallback: user_id 없이 (FK / 컬럼 미존재 케이스 대비)
    const retry = await supabase
      .from("travel_plans")
      .insert(input)
      .select("*")
      .single();
    if (!retry.error) await fetchPlans();
    return { data: retry.data, error: retry.error };
  };

  const updatePlan = async (id: string, updates: Partial<TravelPlan>) => {
    const { error } = await supabase
      .from("travel_plans")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) await fetchPlans();
    return { error };
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from("travel_plans").delete().eq("id", id);
    if (!error) await fetchPlans();
    return { error };
  };

  return { plans, loading, addPlan, updatePlan, deletePlan, refetch: fetchPlans };
}

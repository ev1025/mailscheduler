"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUserId } from "@/lib/current-user";
import type { TravelPlan } from "@/types";

/**
 * visibleUserIds: 달력 탭에서 선택한 "볼 사용자들"
 *  - 전달 시 해당 사용자들의 계획 조회 (공유된 계획 포함)
 *  - 생략 시 내 계획만
 *
 * 공유된 계획도 수정 가능 (RLS 정책에서 owner + accepted share 모두 허용).
 */
export function useTravelPlans(visibleUserIds?: string[]) {
  const userId = useCurrentUserId();
  const [plans, setPlans] = useState<TravelPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const visibleKey = visibleUserIds?.join(",") ?? "";

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("travel_plans")
      .select("*")
      .order("updated_at", { ascending: false });
    const filterIds =
      visibleUserIds && visibleUserIds.length > 0
        ? visibleUserIds
        : (userId ? [userId] : []);
    if (filterIds.length > 0) query = query.in("user_id", filterIds);
    const { data, error } = await query;
    if (error) {
      // user_id 컬럼 미존재 구버전 대비
      const fallback = await supabase
        .from("travel_plans")
        .select("*")
        .order("updated_at", { ascending: false });
      if (fallback.data) setPlans(fallback.data);
    } else if (data) {
      setPlans(data);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, visibleKey]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // 앱이 다시 포그라운드로 올라올 때 재조회 —
  // 공유자가 업데이트한 내용이 세션 중에 갱신되도록. auth 토큰 refresh 후
  // 또는 백그라운드→포그라운드 복귀 타이밍에 stale 데이터 제거.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchPlans();
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") fetchPlans();
    });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      sub.subscription.unsubscribe();
    };
  }, [fetchPlans]);

  const addPlan = async (
    input: Pick<TravelPlan, "title"> & Partial<Pick<TravelPlan, "start_date" | "end_date" | "notes">>
  ) => {
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

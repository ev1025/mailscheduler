"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUserId } from "@/lib/current-user";

/**
 * 결제수단 — Supabase payment_methods 테이블에서 조회/관리.
 * 이전엔 localStorage 였으나 디바이스 동기화 + 다중유저 분리를 위해 DB 로 이전.
 *
 * 시드값(카드/현금/계좌이체/자동이체/간편결제)은 supabase-categories-migration.sql
 * 에서 모든 기존 유저에게 INSERT. 신규 유저는 회원가입 후 첫 사용 시 비어 있을 수
 * 있어 클라이언트 자동 시드를 백업으로 둠.
 */

export interface PaymentMethod {
  id: string;
  name: string;
  color: string;
  sort_order?: number;
}

const DEFAULT_SEED: { name: string; color: string; sort_order: number }[] = [
  { name: "카드", color: "#3B82F6", sort_order: 0 },
  { name: "현금", color: "#22C55E", sort_order: 1 },
  { name: "계좌이체", color: "#A855F7", sort_order: 2 },
  { name: "자동이체", color: "#F59E0B", sort_order: 3 },
  { name: "간편결제", color: "#E4D547", sort_order: 4 },
];

export function usePaymentMethods() {
  const userId = useCurrentUserId();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  const fetchMethods = useCallback(async () => {
    if (!userId) {
      setMethods([]);
      return;
    }
    const { data } = await supabase
      .from("payment_methods")
      .select("id, name, color, sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (!data || data.length === 0) {
      // 신규 유저 — 시드 자동 INSERT.
      await supabase
        .from("payment_methods")
        .insert(DEFAULT_SEED.map((s) => ({ ...s, user_id: userId })));
      const retry = await supabase
        .from("payment_methods")
        .select("id, name, color, sort_order")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true });
      if (retry.data) setMethods(retry.data as PaymentMethod[]);
      return;
    }
    setMethods(data as PaymentMethod[]);
  }, [userId]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const addMethod = useCallback(
    async (name: string, color?: string) => {
      const trimmed = name.trim();
      if (!trimmed) return { error: "empty" };
      if (!userId) return { error: "no user" };
      // 이미 같은 이름 있으면 no-op.
      if (methods.some((m) => m.name === trimmed)) return { error: null };
      const maxOrder = methods.reduce((m, x) => Math.max(m, x.sort_order ?? 0), -1);
      const { error } = await supabase.from("payment_methods").insert({
        user_id: userId,
        name: trimmed,
        color: color || "#6B7280",
        sort_order: maxOrder + 1,
      });
      if (!error) await fetchMethods();
      return { error };
    },
    [userId, methods, fetchMethods],
  );

  const deleteMethod = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("payment_methods").delete().eq("id", id);
      if (!error) await fetchMethods();
      return { error };
    },
    [fetchMethods],
  );

  const updateMethodColor = useCallback(
    async (id: string, color: string) => {
      // 낙관적 업데이트 — 색은 즉시 반영.
      setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, color } : m)));
      const { error } = await supabase.from("payment_methods").update({ color }).eq("id", id);
      if (error) await fetchMethods();
      return { error };
    },
    [fetchMethods],
  );

  return { methods, addMethod, deleteMethod, updateMethodColor };
}

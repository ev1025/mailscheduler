"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUserId } from "@/lib/current-user";

/**
 * 생필품 분류 — Supabase product_categories 테이블에서 조회/관리.
 * 이전엔 localStorage 였으나 디바이스 동기화 위해 DB 로 이전.
 *
 * 빌트인 vs 사용자 추가 구분: is_builtin 컬럼.
 * 시드(영양제/화장품/단백질/음식/생필품/구독)는 SQL 마이그레이션에서 모든 기존 유저에게 INSERT.
 */

export interface ProductCategoryTag {
  id: string; // DB row id
  name: string;
  color: string;
  is_builtin?: boolean;
  sort_order?: number;
}

const DEFAULT_SEED: { name: string; color: string; sort_order: number }[] = [
  { name: "영양제", color: "#22C55E", sort_order: 0 },
  { name: "화장품", color: "#EC4899", sort_order: 1 },
  { name: "단백질", color: "#F59E0B", sort_order: 2 },
  { name: "음식",   color: "#EF4444", sort_order: 3 },
  { name: "생필품", color: "#3B82F6", sort_order: 4 },
  { name: "구독",   color: "#8B5CF6", sort_order: 5 },
];

export function useProductCategories() {
  const userId = useCurrentUserId();
  const [tags, setTags] = useState<ProductCategoryTag[]>([]);

  const fetchTags = useCallback(async () => {
    if (!userId) {
      setTags([]);
      return;
    }
    const { data } = await supabase
      .from("product_categories")
      .select("id, name, color, is_builtin, sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (!data || data.length === 0) {
      await supabase
        .from("product_categories")
        .insert(
          DEFAULT_SEED.map((s) => ({ ...s, user_id: userId, is_builtin: true })),
        );
      const retry = await supabase
        .from("product_categories")
        .select("id, name, color, is_builtin, sort_order")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true });
      if (retry.data) setTags(retry.data as ProductCategoryTag[]);
      return;
    }
    setTags(data as ProductCategoryTag[]);
  }, [userId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // name만 필요한 기존 소비자용
  const categories: string[] = tags.map((t) => t.name);

  const addCategory = useCallback(
    async (name: string, color?: string) => {
      const trimmed = name.trim();
      if (!trimmed) return { error: null };
      if (!userId) return { error: "no user" };
      if (tags.some((t) => t.name === trimmed)) return { error: null };
      const maxOrder = tags.reduce((m, t) => Math.max(m, t.sort_order ?? 0), -1);
      const { error } = await supabase.from("product_categories").insert({
        user_id: userId,
        name: trimmed,
        color: color || "#6B7280",
        is_builtin: false,
        sort_order: maxOrder + 1,
      });
      if (!error) await fetchTags();
      return { error };
    },
    [userId, tags, fetchTags],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      // id 가 DB row id 가 아니라 name 으로 들어올 수 있어 (legacy API) 양쪽 매칭.
      const target = tags.find((t) => t.id === id || t.name === id);
      if (!target) return { error: "not found" };
      if (target.is_builtin) return { error: "기본 분류는 삭제할 수 없습니다" };
      const { error } = await supabase
        .from("product_categories")
        .delete()
        .eq("id", target.id);
      if (!error) await fetchTags();
      return { error };
    },
    [tags, fetchTags],
  );

  const updateCategoryColor = useCallback(
    async (id: string, color: string) => {
      const target = tags.find((t) => t.id === id || t.name === id);
      if (!target) return { error: "not found" };
      setTags((prev) => prev.map((t) => (t.id === target.id ? { ...t, color } : t)));
      const { error } = await supabase
        .from("product_categories")
        .update({ color })
        .eq("id", target.id);
      if (error) await fetchTags();
      return { error };
    },
    [tags, fetchTags],
  );

  return {
    categories,
    tags: tags.map((t) => ({ id: t.name, name: t.name, color: t.color })),
    addCategory,
    deleteCategory,
    updateCategoryColor,
    customCategories: tags.filter((t) => !t.is_builtin).map((t) => t.name),
    removeCategory: deleteCategory,
  };
}

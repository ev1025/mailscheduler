"use client";

import { useCallback, useEffect, useState } from "react";
import { randomTagColor, readLocalJSON, writeLocalJSON } from "@/lib/tag-store";

const CUSTOM_KEY = "travel_categories_custom";
const COLOR_KEY = "travel-category-colors";

const BUILTIN = ["자연", "숙소", "식당", "놀거리", "데이트", "공연", "쇼핑", "기타"];

const DEFAULT_COLORS: Record<string, string> = {
  자연: "#22C55E",
  숙소: "#A855F7",
  식당: "#F59E0B",
  놀거리: "#3B82F6",
  데이트: "#EC4899",
  공연: "#8B5CF6",
  쇼핑: "#06B6D4",
  기타: "#6B7280",
};

export function useTravelCategories() {
  const [custom, setCustom] = useState<string[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({ ...DEFAULT_COLORS });

  useEffect(() => {
    setCustom(readLocalJSON<string[]>(CUSTOM_KEY, []));
    setColors({ ...DEFAULT_COLORS, ...readLocalJSON<Record<string, string>>(COLOR_KEY, {}) });
  }, []);

  const categories: string[] = [...BUILTIN, ...custom.filter((c) => !BUILTIN.includes(c))];

  const addCategory = useCallback(async (name: string, color?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: "empty" };
    if (BUILTIN.includes(trimmed)) return { error: null };
    setCustom((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      writeLocalJSON(CUSTOM_KEY, next);
      return next;
    });
    const assigned = color || randomTagColor();
    setColors((prev) => {
      const next = { ...prev, [trimmed]: assigned };
      writeLocalJSON(COLOR_KEY, next);
      return next;
    });
    return { error: null };
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    if (BUILTIN.includes(id)) return { error: "builtin" };
    setCustom((prev) => {
      const next = prev.filter((c) => c !== id);
      writeLocalJSON(CUSTOM_KEY, next);
      return next;
    });
    return { error: null };
  }, []);

  const updateCategoryColor = useCallback(async (id: string, color: string) => {
    setColors((prev) => {
      const next = { ...prev, [id]: color };
      writeLocalJSON(COLOR_KEY, next);
      return next;
    });
    return { error: null };
  }, []);

  const updateCategoryName = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: "empty" };
    if (trimmed === id) return { error: null };
    if (BUILTIN.includes(id)) return { error: "builtin" };
    setCustom((prev) => {
      if (!prev.includes(id)) return prev;
      const next = prev.map((c) => (c === id ? trimmed : c));
      writeLocalJSON(CUSTOM_KEY, next);
      return next;
    });
    setColors((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: color, ...rest } = prev;
      const next = { ...rest, [trimmed]: color };
      writeLocalJSON(COLOR_KEY, next);
      return next;
    });
    return { error: null };
  }, []);

  return { categories, colors, addCategory, deleteCategory, updateCategoryColor, updateCategoryName };
}

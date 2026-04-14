"use client";

import { useCallback, useEffect, useState } from "react";

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

const PALETTE = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
];

function loadCustom(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function loadColors(): Record<string, string> {
  if (typeof window === "undefined") return { ...DEFAULT_COLORS };
  try {
    const raw = localStorage.getItem(COLOR_KEY);
    if (!raw) return { ...DEFAULT_COLORS };
    return { ...DEFAULT_COLORS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_COLORS };
  }
}

export function useTravelCategories() {
  const [custom, setCustom] = useState<string[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({ ...DEFAULT_COLORS });

  useEffect(() => {
    setCustom(loadCustom());
    setColors(loadColors());
  }, []);

  const categories: string[] = [...BUILTIN, ...custom.filter((c) => !BUILTIN.includes(c))];

  const addCategory = useCallback(async (name: string, color?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: "empty" };
    if (BUILTIN.includes(trimmed)) return { error: null };
    setCustom((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
    const assigned = color || PALETTE[Math.floor(Math.random() * PALETTE.length)];
    setColors((prev) => {
      const next = { ...prev, [trimmed]: assigned };
      localStorage.setItem(COLOR_KEY, JSON.stringify(next));
      return next;
    });
    return { error: null };
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    if (BUILTIN.includes(id)) return { error: "builtin" };
    setCustom((prev) => {
      const next = prev.filter((c) => c !== id);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
    return { error: null };
  }, []);

  const updateCategoryColor = useCallback(async (id: string, color: string) => {
    setColors((prev) => {
      const next = { ...prev, [id]: color };
      localStorage.setItem(COLOR_KEY, JSON.stringify(next));
      return next;
    });
    return { error: null };
  }, []);

  return { categories, colors, addCategory, deleteCategory, updateCategoryColor };
}

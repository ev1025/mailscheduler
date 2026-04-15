"use client";

import { useCallback, useEffect, useState } from "react";

const CUSTOM_KEY = "product_mid_categories_custom"; // string[] (사용자 추가)
const COLOR_KEY = "product_mid_categories_colors"; // Record<string, string>

// 누구에게나 기본으로 보이는 분류 + 고정 기본 색상.
const BUILTIN: { name: string; color: string }[] = [
  { name: "영양제", color: "#22C55E" },
  { name: "화장품", color: "#EC4899" },
  { name: "단백질", color: "#F59E0B" },
  { name: "음식", color: "#EF4444" },
  { name: "생필품", color: "#3B82F6" },
  { name: "구독", color: "#8B5CF6" },
  { name: "기타", color: "#6B7280" },
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
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(COLOR_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export interface ProductCategoryTag {
  id: string; // name 자체를 id로 사용
  name: string;
  color: string;
}

export function useProductCategories() {
  const [custom, setCustom] = useState<string[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});

  useEffect(() => {
    setCustom(loadCustom());
    setColors(loadColors());
  }, []);

  const builtinNames = BUILTIN.map((b) => b.name);

  const tags: ProductCategoryTag[] = [
    ...BUILTIN.map((b) => ({
      id: b.name,
      name: b.name,
      color: colors[b.name] || b.color,
    })),
    ...custom
      .filter((c) => !builtinNames.includes(c))
      .map((c) => ({
        id: c,
        name: c,
        color: colors[c] || "#6B7280",
      })),
  ];

  // name만 필요한 기존 소비자용
  const categories: string[] = tags.map((t) => t.name);

  const addCategory = useCallback(async (name: string, color?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: null };
    if (builtinNames.includes(trimmed)) return { error: null };
    setCustom((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
    if (color) {
      setColors((prev) => {
        const next = { ...prev, [trimmed]: color };
        localStorage.setItem(COLOR_KEY, JSON.stringify(next));
        return next;
      });
    }
    return { error: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    if (builtinNames.includes(id)) return { error: "기본 분류는 삭제할 수 없습니다" };
    setCustom((prev) => {
      const next = prev.filter((c) => c !== id);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
    return { error: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCategoryColor = useCallback(async (id: string, color: string) => {
    setColors((prev) => {
      const next = { ...prev, [id]: color };
      localStorage.setItem(COLOR_KEY, JSON.stringify(next));
      return next;
    });
    return { error: null };
  }, []);

  return {
    categories,
    tags,
    addCategory,
    deleteCategory,
    updateCategoryColor,
    // 구버전 호환
    customCategories: custom,
    removeCategory: deleteCategory,
  };
}

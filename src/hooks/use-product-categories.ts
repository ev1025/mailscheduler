"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "product_mid_categories_custom";

const BUILTIN: string[] = [
  "영양제",
  "화장품",
  "단백질",
  "음식",
  "생필품",
  "구독",
  "기타",
];

function loadCustom(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useProductCategories() {
  const [custom, setCustom] = useState<string[]>([]);

  useEffect(() => {
    setCustom(loadCustom());
  }, []);

  const categories: string[] = [...BUILTIN, ...custom.filter((c) => !BUILTIN.includes(c))];

  const addCategory = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (BUILTIN.includes(trimmed)) return;
    setCustom((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeCategory = useCallback((name: string) => {
    if (BUILTIN.includes(name)) return;
    setCustom((prev) => {
      const next = prev.filter((c) => c !== name);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { categories, customCategories: custom, addCategory, removeCategory };
}

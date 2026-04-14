"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "product_subtags_by_category";

export interface ProductSubTag {
  id: string;
  name: string;
  color: string;
}

type StoreShape = Record<string, ProductSubTag[]>;

const PALETTE = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
];

function load(): StoreShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoreShape;
  } catch {
    return {};
  }
}

function save(data: StoreShape) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useProductSubTags(category: string) {
  const [store, setStore] = useState<StoreShape>({});

  useEffect(() => {
    setStore(load());
  }, []);

  const tags = store[category] || [];

  const addTag = useCallback(
    async (name: string, color?: string) => {
      const trimmed = name.trim();
      if (!trimmed) return { error: "empty" };
      setStore((prev) => {
        const existing = prev[category] || [];
        if (existing.some((t) => t.name === trimmed)) return prev;
        const newTag: ProductSubTag = {
          id: "stag_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: trimmed,
          color: color || PALETTE[Math.floor(Math.random() * PALETTE.length)],
        };
        const next = { ...prev, [category]: [...existing, newTag] };
        save(next);
        return next;
      });
      return { error: null };
    },
    [category]
  );

  const deleteTag = useCallback(
    async (id: string) => {
      setStore((prev) => {
        const existing = prev[category] || [];
        const next = { ...prev, [category]: existing.filter((t) => t.id !== id) };
        save(next);
        return next;
      });
      return { error: null };
    },
    [category]
  );

  const updateTagColor = useCallback(
    async (id: string, color: string) => {
      setStore((prev) => {
        const existing = prev[category] || [];
        const next = {
          ...prev,
          [category]: existing.map((t) => (t.id === id ? { ...t, color } : t)),
        };
        save(next);
        return next;
      });
      return { error: null };
    },
    [category]
  );

  return { tags, addTag, deleteTag, updateTagColor };
}

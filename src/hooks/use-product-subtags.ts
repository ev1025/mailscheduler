"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createTagId,
  randomTagColor,
  readLocalJSON,
  writeLocalJSON,
} from "@/lib/tag-store";

const STORAGE_KEY = "product_subtags_by_category";

export interface ProductSubTag {
  id: string;
  name: string;
  color: string;
}

type StoreShape = Record<string, ProductSubTag[]>;

export function useProductSubTags(category: string) {
  const [store, setStore] = useState<StoreShape>({});

  useEffect(() => {
    setStore(readLocalJSON<StoreShape>(STORAGE_KEY, {}));
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
          id: createTagId("stag"),
          name: trimmed,
          color: color || randomTagColor(),
        };
        const next = { ...prev, [category]: [...existing, newTag] };
        writeLocalJSON(STORAGE_KEY, next);
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
        writeLocalJSON(STORAGE_KEY, next);
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
        writeLocalJSON(STORAGE_KEY, next);
        return next;
      });
      return { error: null };
    },
    [category]
  );

  return { tags, addTag, deleteTag, updateTagColor };
}

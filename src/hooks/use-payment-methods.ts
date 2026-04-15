"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createTagId,
  randomTagColor,
  readLocalJSON,
  writeLocalJSON,
} from "@/lib/tag-store";

const STORAGE_KEY = "payment_methods";
const DEFAULTS = ["카드", "현금", "계좌이체", "기타"];
const SEED_COLORS = ["#3B82F6", "#22C55E", "#A855F7", "#F59E0B"];

export interface PaymentMethod {
  id: string;
  name: string;
  color: string;
}

function seed(): PaymentMethod[] {
  return DEFAULTS.map((name, i) => ({
    id: `pm_${name}`,
    name,
    color: SEED_COLORS[i % SEED_COLORS.length],
  }));
}

function load(): PaymentMethod[] {
  const parsed = readLocalJSON<PaymentMethod[]>(STORAGE_KEY, []);
  return Array.isArray(parsed) && parsed.length > 0 ? parsed : seed();
}

export function usePaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    setMethods(load());
  }, []);

  const addMethod = useCallback(async (name: string, color?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { error: "empty" };
    setMethods((prev) => {
      if (prev.some((m) => m.name === trimmed)) return prev;
      const newMethod: PaymentMethod = {
        id: createTagId("pm"),
        name: trimmed,
        color: color || randomTagColor(),
      };
      const next = [...prev, newMethod];
      writeLocalJSON(STORAGE_KEY, next);
      return next;
    });
    return { error: null };
  }, []);

  const deleteMethod = useCallback(async (id: string) => {
    setMethods((prev) => {
      const next = prev.filter((m) => m.id !== id);
      writeLocalJSON(STORAGE_KEY, next);
      return next;
    });
    return { error: null };
  }, []);

  const updateMethodColor = useCallback(async (id: string, color: string) => {
    setMethods((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, color } : m));
      writeLocalJSON(STORAGE_KEY, next);
      return next;
    });
    return { error: null };
  }, []);

  return { methods, addMethod, deleteMethod, updateMethodColor };
}

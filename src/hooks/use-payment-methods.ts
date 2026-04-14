"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "payment_methods";
const DEFAULTS = ["카드", "현금", "계좌이체", "기타"];

const PALETTE = [
  "#3B82F6", "#22C55E", "#A855F7", "#F59E0B",
  "#EF4444", "#06B6D4", "#EC4899", "#8B5CF6",
];

export interface PaymentMethod {
  id: string;
  name: string;
  color: string;
}

function seed(): PaymentMethod[] {
  return DEFAULTS.map((name, i) => ({
    id: `pm_${name}`,
    name,
    color: PALETTE[i % PALETTE.length],
  }));
}

function load(): PaymentMethod[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

function save(methods: PaymentMethod[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(methods));
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
        id: `pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        color: color || PALETTE[Math.floor(Math.random() * PALETTE.length)],
      };
      const next = [...prev, newMethod];
      save(next);
      return next;
    });
    return { error: null };
  }, []);

  const deleteMethod = useCallback(async (id: string) => {
    setMethods((prev) => {
      const next = prev.filter((m) => m.id !== id);
      save(next);
      return next;
    });
    return { error: null };
  }, []);

  const updateMethodColor = useCallback(async (id: string, color: string) => {
    setMethods((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, color } : m));
      save(next);
      return next;
    });
    return { error: null };
  }, []);

  return { methods, addMethod, deleteMethod, updateMethodColor };
}

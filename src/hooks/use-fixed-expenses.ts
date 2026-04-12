"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ExpenseCategory } from "@/types";

export interface FixedExpense {
  id: string;
  amount: number;
  category_id: string;
  description: string | null;
  day_of_month: number;
  type: "income" | "expense";
  payment_method: string;
  is_active: boolean;
  created_at: string;
  category?: ExpenseCategory;
}

export function useFixedExpenses() {
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFixed = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fixed_expenses")
      .select("*, category:expense_categories(*)")
      .eq("is_active", true)
      .order("day_of_month");
    if (!error && data) setFixedExpenses(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFixed();
  }, [fetchFixed]);

  const addFixed = async (item: Omit<FixedExpense, "id" | "created_at" | "category" | "is_active">) => {
    const { error } = await supabase.from("fixed_expenses").insert(item);
    if (!error) await fetchFixed();
    return { error };
  };

  const deleteFixed = async (id: string) => {
    const { error } = await supabase.from("fixed_expenses").update({ is_active: false }).eq("id", id);
    if (!error) await fetchFixed();
    return { error };
  };

  // 해당 월에 고정비를 일괄 추가
  const applyFixedToMonth = async (year: number, month: number, existingTransactions: { description: string | null; amount: number; date: string }[]) => {
    let count = 0;
    for (const fx of fixedExpenses) {
      const day = Math.min(fx.day_of_month, new Date(year, month, 0).getDate());
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // 이미 같은 금액+설명+날짜 내역이 있으면 스킵
      const exists = existingTransactions.some(
        (t) => t.amount === fx.amount && t.description === fx.description && t.date === date
      );
      if (exists) continue;

      await supabase.from("expenses").insert({
        amount: fx.amount,
        category_id: fx.category_id,
        description: fx.description,
        date,
        type: fx.type,
        payment_method: fx.payment_method,
      });
      count++;
    }
    return count;
  };

  return { fixedExpenses, loading, addFixed, deleteFixed, applyFixedToMonth, refetch: fetchFixed };
}

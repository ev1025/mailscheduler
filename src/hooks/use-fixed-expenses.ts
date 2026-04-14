"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ExpenseCategory } from "@/types";
import { useCurrentUserId } from "@/lib/current-user";

export interface FixedExpense {
  id: string;
  amount: number;
  category_id: string;
  description: string | null;
  day_of_month: number;
  type: "income" | "expense";
  payment_method: string;
  is_active: boolean;
  product_id?: string | null;
  main_category?: string | null;
  sub_category?: string | null;
  created_at: string;
  category?: ExpenseCategory;
}

export function useFixedExpenses() {
  const userId = useCurrentUserId();
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFixed = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("fixed_expenses")
      .select("*, category:expense_categories(*)")
      .eq("is_active", true)
      .order("day_of_month");
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) {
      const fallback = await supabase
        .from("fixed_expenses")
        .select("*, category:expense_categories(*)")
        .eq("is_active", true)
        .order("day_of_month");
      if (fallback.data) setFixedExpenses(fallback.data);
    } else if (data) {
      setFixedExpenses(data);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchFixed();
  }, [fetchFixed]);

  const addFixed = async (
    item: Omit<FixedExpense, "id" | "created_at" | "category" | "is_active">
  ) => {
    const { error } = await supabase
      .from("fixed_expenses")
      .insert({ ...item, user_id: userId });
    if (error) {
      const retry = await supabase.from("fixed_expenses").insert(item);
      if (!retry.error) await fetchFixed();
      return { error: retry.error };
    }
    await fetchFixed();
    return { error: null };
  };

  const updateFixed = async (
    id: string,
    updates: Partial<Omit<FixedExpense, "id" | "created_at" | "category">>
  ) => {
    const { error } = await supabase
      .from("fixed_expenses")
      .update(updates)
      .eq("id", id);
    if (!error) await fetchFixed();
    return { error };
  };

  const deleteFixed = async (id: string) => {
    const { error } = await supabase
      .from("fixed_expenses")
      .update({ is_active: false })
      .eq("id", id);
    if (!error) await fetchFixed();
    return { error };
  };

  const deleteFixedByProduct = async (productId: string) => {
    const { error } = await supabase
      .from("fixed_expenses")
      .update({ is_active: false })
      .eq("product_id", productId);
    if (!error) await fetchFixed();
    return { error };
  };

  const upsertFixedFromProduct = async (params: {
    productId: string;
    productName: string;
    monthlyCost: number;
    paymentDay: number;
    categoryId: string;
  }) => {
    const { data: existing } = await supabase
      .from("fixed_expenses")
      .select("id")
      .eq("product_id", params.productId)
      .eq("is_active", true)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("fixed_expenses")
        .update({
          amount: params.monthlyCost,
          day_of_month: params.paymentDay,
          description: params.productName,
        })
        .eq("id", existing.id);
      if (!error) await fetchFixed();
      return { error };
    }
    const { error } = await supabase.from("fixed_expenses").insert({
      amount: params.monthlyCost,
      category_id: params.categoryId,
      description: params.productName,
      day_of_month: params.paymentDay,
      type: "expense",
      payment_method: "카드",
      is_active: true,
      product_id: params.productId,
      user_id: userId,
    });
    if (!error) await fetchFixed();
    return { error };
  };

  const applyFixedToMonth = async (
    year: number,
    month: number,
    existingTransactions: {
      description: string | null;
      amount: number;
      date: string;
    }[]
  ) => {
    let count = 0;
    for (const fx of fixedExpenses) {
      const day = Math.min(
        fx.day_of_month,
        new Date(year, month, 0).getDate()
      );
      const date = `${year}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;

      const exists = existingTransactions.some(
        (t) =>
          t.amount === fx.amount &&
          t.description === fx.description &&
          t.date === date
      );
      if (exists) continue;

      await supabase.from("expenses").insert({
        amount: fx.amount,
        category_id: fx.category_id,
        description: fx.description,
        date,
        type: fx.type,
        payment_method: fx.payment_method,
        user_id: userId,
      });
      count++;
    }
    return count;
  };

  return {
    fixedExpenses,
    loading,
    addFixed,
    updateFixed,
    deleteFixed,
    deleteFixedByProduct,
    upsertFixedFromProduct,
    applyFixedToMonth,
    refetch: fetchFixed,
  };
}

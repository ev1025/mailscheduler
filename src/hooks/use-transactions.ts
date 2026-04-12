"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Expense, ExpenseCategory } from "@/types";

export function useTransactions(year: number, month: number) {
  const [transactions, setTransactions] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from("expense_categories")
      .select("*")
      .order("name");
    if (data) setCategories(data);
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*, category:expense_categories(*)")
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && data) setTransactions(data);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = async (
    tx: Omit<Expense, "id" | "created_at" | "category">
  ) => {
    const { error } = await supabase.from("expenses").insert(tx);
    if (!error) await fetchTransactions();
    return { error };
  };

  const updateTransaction = async (
    id: string,
    updates: Partial<Omit<Expense, "id" | "created_at" | "category">>
  ) => {
    const { error } = await supabase
      .from("expenses")
      .update(updates)
      .eq("id", id);
    if (!error) await fetchTransactions();
    return { error };
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (!error) await fetchTransactions();
    return { error };
  };

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;

  const expenseByCategory = transactions
    .filter((t) => t.type === "expense" && t.category)
    .reduce(
      (acc, t) => {
        const catName = t.category!.name;
        const catColor = t.category!.color;
        if (!acc[catName]) acc[catName] = { amount: 0, color: catColor };
        acc[catName].amount += t.amount;
        return acc;
      },
      {} as Record<string, { amount: number; color: string }>
    );

  return {
    transactions,
    categories,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    totalIncome,
    totalExpense,
    balance,
    expenseByCategory,
    refetch: fetchTransactions,
  };
}

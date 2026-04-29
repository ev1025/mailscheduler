"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ExpenseCategory } from "@/types";
import { useCurrentUserId } from "@/lib/current-user";

export interface FixedExpense {
  id: string;
  /** 지출명(제목) — 목록에서 가장 크게 표시. 없으면 description/카테고리명으로 폴백. */
  title: string | null;
  amount: number;
  category_id: string;
  /** 메모 — 폼에서만 보이는 상세 내용. */
  description: string | null;
  day_of_month: number;
  type: "income" | "expense";
  payment_method: string;
  is_active: boolean;
  product_id?: string | null;
  /** 반복 등록 개월 수. 1=이번달만, -1=계속(120), N=N개월. 폼에서 그대로 표시. */
  repeat_months?: number | null;
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

  /**
   * 고정비 추가 + 이번달부터 N개월 거래 일괄 생성.
   * - repeatMonths = 1 : 이번달만 (기본)
   * - repeatMonths = N : 이번달 포함 N개월 연속
   * - repeatMonths = -1 (계속) : 120개월(10년) 까지
   *
   * 캘린더 일정의 "반복 횟수" 와 동일한 의미. 페이지 마운트 자동 적용은 제거되어
   * 있으므로 거래는 여기서만 생성됨 → 중복 없음.
   */
  const addFixed = async (
    item: Omit<FixedExpense, "id" | "created_at" | "category" | "is_active">,
    repeatMonths: number = 1,
  ) => {
    // repeat_months 컬럼에 같이 저장 — 수정 폼에서 그대로 표시.
    const { error } = await supabase
      .from("fixed_expenses")
      .insert({ ...item, user_id: userId, repeat_months: repeatMonths });
    if (error) {
      // repeat_months 컬럼 없는 구 DB 폴백.
      const { title, repeat_months, ...rest } = item as typeof item & { repeat_months?: number };
      void title;
      void repeat_months;
      const retry = await supabase.from("fixed_expenses").insert(rest);
      if (retry.error) return { error: retry.error };
    }

    // N개월 거래 일괄 생성. 무한(-1) → 120개월 (캘린더 monthly 무한과 동일).
    const months = repeatMonths === -1 ? 120 : Math.max(1, repeatMonths);
    const today = new Date();
    const baseYear = today.getFullYear();
    const baseMonth = today.getMonth() + 1; // 1-indexed
    const txs: Record<string, unknown>[] = [];
    for (let i = 0; i < months; i++) {
      const t = new Date(baseYear, baseMonth - 1 + i, 1);
      const yi = t.getFullYear();
      const mi = t.getMonth() + 1;
      const lastDay = new Date(yi, mi, 0).getDate();
      const day = Math.min(item.day_of_month, lastDay);
      const date = `${yi}-${String(mi).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      txs.push({
        title: item.title,
        amount: item.amount,
        category_id: item.category_id,
        description: item.description,
        date,
        type: item.type,
        payment_method: item.payment_method,
        user_id: userId,
      });
    }
    if (txs.length > 0) {
      const ins = await supabase.from("expenses").insert(txs);
      if (ins.error) {
        // user_id/title 미지원 구 DB 폴백
        const fallback = txs.map((t) => {
          const { title, user_id, ...rest } = t as { title?: unknown; user_id?: unknown } & Record<string, unknown>;
          void title;
          void user_id;
          return rest;
        });
        await supabase.from("expenses").insert(fallback);
      }
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
    if (error) {
      // title / repeat_months 미지원 구 DB 폴백
      const { title, repeat_months, ...rest } = updates as typeof updates & { repeat_months?: number };
      void title;
      void repeat_months;
      const retry = await supabase
        .from("fixed_expenses")
        .update(rest)
        .eq("id", id);
      if (!retry.error) await fetchFixed();
      return { error: retry.error };
    }
    await fetchFixed();
    return { error: null };
  };

  const deleteFixed = async (id: string) => {
    const { error } = await supabase
      .from("fixed_expenses")
      .update({ is_active: false })
      .eq("id", id);
    if (!error) await fetchFixed();
    return { error };
  };

  /**
   * 고정비 비활성화 + 매칭되는 거래(amount+description) 일괄 삭제.
   * scope = "this-month": 이번달(year/month) 1일부터 미래 모두 삭제
   * scope = "next-month": 다음달 1일부터 미래 모두 삭제 (이번달은 유지)
   *
   * 매칭 키: amount + description. 같은 amount/desc 의 다른 거래도 영향 받을 수 있으나
   * 일반적으로 고정비 자동 등록 외엔 충돌 적음. 정확히 따로 추적하려면 별도 fk 컬럼 필요.
   */
  const deleteFixedWithScope = async (
    id: string,
    scope: "this-month" | "next-month",
    year: number,
    month: number,
  ) => {
    const fx = fixedExpenses.find((f) => f.id === id);
    if (!fx) return { error: "고정비를 찾을 수 없습니다" };
    const r1 = await supabase
      .from("fixed_expenses")
      .update({ is_active: false })
      .eq("id", id);
    if (r1.error) return { error: r1.error };

    // 삭제 시작일 — this-month: 이번달 1일 / next-month: 다음달 1일.
    const startDate =
      scope === "this-month"
        ? `${year}-${String(month).padStart(2, "0")}-01`
        : month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    let q = supabase
      .from("expenses")
      .delete()
      .gte("date", startDate)
      .eq("amount", fx.amount);
    if (fx.description === null) q = q.is("description", null);
    else q = q.eq("description", fx.description);
    if (userId) q = q.eq("user_id", userId);
    await q;

    await fetchFixed();
    return { error: null };
  };

  /**
   * 고정비 수정 + 매칭되는 거래(이번달/다음달부터 미래) 일괄 갱신.
   * scope = "this-month": 이번달 1일부터 미래 모두 propagate
   * scope = "next-month": 다음달 1일부터 미래 모두 propagate (이번달은 유지)
   *
   * 전파되는 필드: amount, description, title, category_id, payment_method, day_of_month.
   * day_of_month 변경 시 매칭 tx 의 date 도 그 달의 새 day 로 갱신 (월말 클램프 포함).
   */
  const updateFixedWithScope = async (
    id: string,
    updates: Partial<Omit<FixedExpense, "id" | "created_at" | "category">>,
    scope: "this-month" | "next-month",
    year: number,
    month: number,
  ) => {
    const fx = fixedExpenses.find((f) => f.id === id);
    if (!fx) return { error: "고정비를 찾을 수 없습니다" };

    // 1. fixed_expense update
    const r1 = await updateFixed(id, updates);
    if (r1.error) return { error: r1.error };

    // 2. 매칭 거래 fetch — 시작일은 scope 에 따라.
    const startDate =
      scope === "this-month"
        ? `${year}-${String(month).padStart(2, "0")}-01`
        : month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    let q = supabase
      .from("expenses")
      .select("id, date")
      .gte("date", startDate)
      .eq("amount", fx.amount);
    if (fx.description === null) q = q.is("description", null);
    else q = q.eq("description", fx.description);
    if (userId) q = q.eq("user_id", userId);
    const { data: txs } = await q;

    if (!txs || txs.length === 0) return { error: null };

    // 3. 변경된 필드만 추려 per-tx update. day_of_month 변경 시 date 계산.
    const dayChanged =
      updates.day_of_month !== undefined && updates.day_of_month !== fx.day_of_month;
    const baseUpdate: Record<string, unknown> = {};
    if (updates.amount !== undefined && updates.amount !== fx.amount)
      baseUpdate.amount = updates.amount;
    if (updates.title !== undefined) baseUpdate.title = updates.title;
    if (updates.description !== undefined) baseUpdate.description = updates.description;
    if (updates.category_id !== undefined && updates.category_id !== fx.category_id)
      baseUpdate.category_id = updates.category_id;
    if (updates.payment_method !== undefined && updates.payment_method !== fx.payment_method)
      baseUpdate.payment_method = updates.payment_method;

    // day_of_month 가 안 바뀌었고 다른 필드 변경도 없으면 스킵.
    if (!dayChanged && Object.keys(baseUpdate).length === 0) return { error: null };

    for (const tx of txs as { id: string; date: string }[]) {
      const u = { ...baseUpdate };
      if (dayChanged && updates.day_of_month !== undefined) {
        const txYear = parseInt(tx.date.slice(0, 4));
        const txMonth = parseInt(tx.date.slice(5, 7));
        const lastDay = new Date(txYear, txMonth, 0).getDate();
        const newDay = Math.min(updates.day_of_month, lastDay);
        u.date = `${txYear}-${String(txMonth).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;
      }
      if (Object.keys(u).length > 0) {
        await supabase.from("expenses").update(u).eq("id", tx.id);
      }
    }
    return { error: null };
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

      // 고정비의 title/description 을 각각 expenses 의 같은 필드로 전달.
      // title 컬럼 없는 DB 대비 에러 시 title 제거하고 재시도.
      const payload = {
        title: fx.title,
        amount: fx.amount,
        category_id: fx.category_id,
        description: fx.description,
        date,
        type: fx.type,
        payment_method: fx.payment_method,
        user_id: userId,
      };
      const { error } = await supabase.from("expenses").insert(payload);
      if (error) {
        const { title, ...rest } = payload;
        void title;
        await supabase.from("expenses").insert(rest);
      }
      count++;
    }
    return count;
  };

  /**
   * 기존 fx 의 미래 N개월 거래 일괄 보장 (중복은 dedup) — 수정 폼에서 반복 늘릴 때 사용.
   *  - 이번달 포함 N개월 (N=1 → 이번달만, N=-1 → 120개월)
   *  - 같은 (amount, description, date) 조합이 이미 있으면 skip
   *  - 줄이는 동작은 안 함 (이미 등록된 미래 거래는 그대로)
   */
  const ensureFixedMonths = async (
    fxId: string,
    repeatMonths: number,
  ) => {
    const fx = fixedExpenses.find((f) => f.id === fxId);
    if (!fx) return { error: "고정비를 찾을 수 없습니다" };
    const months = repeatMonths === -1 ? 120 : Math.max(1, repeatMonths);
    if (months <= 1) return { error: null }; // 이번달만이면 추가 거래 없음

    const today = new Date();
    const baseYear = today.getFullYear();
    const baseMonth = today.getMonth() + 1;

    // 대상 기간(이번달 ~ +months) 의 기존 거래를 한 번에 조회 → set 으로 dedup.
    const startDate = `${baseYear}-${String(baseMonth).padStart(2, "0")}-01`;
    const endT = new Date(baseYear, baseMonth - 1 + months, 1);
    const endDate = `${endT.getFullYear()}-${String(endT.getMonth() + 1).padStart(2, "0")}-01`;
    let existQ = supabase
      .from("expenses")
      .select("amount, description, date")
      .gte("date", startDate)
      .lt("date", endDate);
    if (userId) existQ = existQ.eq("user_id", userId);
    const { data: existing } = await existQ;
    const set = new Set(
      (existing as { amount: number; description: string | null; date: string }[] | null)?.map(
        (t) => `${t.amount}|${t.description ?? ""}|${t.date}`,
      ) ?? [],
    );

    const txsToInsert: Record<string, unknown>[] = [];
    for (let i = 0; i < months; i++) {
      const t = new Date(baseYear, baseMonth - 1 + i, 1);
      const yi = t.getFullYear();
      const mi = t.getMonth() + 1;
      const lastDay = new Date(yi, mi, 0).getDate();
      const day = Math.min(fx.day_of_month, lastDay);
      const date = `${yi}-${String(mi).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const key = `${fx.amount}|${fx.description ?? ""}|${date}`;
      if (set.has(key)) continue;
      txsToInsert.push({
        title: fx.title,
        amount: fx.amount,
        category_id: fx.category_id,
        description: fx.description,
        date,
        type: fx.type,
        payment_method: fx.payment_method,
        user_id: userId,
      });
    }

    if (txsToInsert.length > 0) {
      const ins = await supabase.from("expenses").insert(txsToInsert);
      if (ins.error) {
        const fallback = txsToInsert.map((t) => {
          const { title, user_id, ...rest } = t as { title?: unknown; user_id?: unknown } & Record<string, unknown>;
          void title;
          void user_id;
          return rest;
        });
        await supabase.from("expenses").insert(fallback);
      }
    }
    return { error: null };
  };

  return {
    fixedExpenses,
    loading,
    addFixed,
    updateFixed,
    deleteFixed,
    deleteFixedByProduct,
    deleteFixedWithScope,
    updateFixedWithScope,
    ensureFixedMonths,
    upsertFixedFromProduct,
    applyFixedToMonth,
    refetch: fetchFixed,
  };
}

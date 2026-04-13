"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ProductPurchase } from "@/types";

export function useProductPurchases(productId: string | null) {
  const [purchases, setPurchases] = useState<ProductPurchase[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPurchases = useCallback(async () => {
    if (!productId) {
      setPurchases([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("product_purchases")
      .select("*")
      .eq("product_id", productId)
      .order("purchased_at", { ascending: false });
    if (!error && data) setPurchases(data as ProductPurchase[]);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const addPurchase = async (
    item: Omit<ProductPurchase, "id" | "created_at">
  ) => {
    const { error } = await supabase.from("product_purchases").insert(item);
    if (!error) await fetchPurchases();
    return { error };
  };

  const updatePurchase = async (
    id: string,
    updates: Partial<ProductPurchase>
  ) => {
    const { error } = await supabase
      .from("product_purchases")
      .update(updates)
      .eq("id", id);
    if (!error) await fetchPurchases();
    return { error };
  };

  const deletePurchase = async (id: string) => {
    const { error } = await supabase
      .from("product_purchases")
      .delete()
      .eq("id", id);
    if (!error) await fetchPurchases();
    return { error };
  };

  return {
    purchases,
    loading,
    addPurchase,
    updatePurchase,
    deletePurchase,
    refetch: fetchPurchases,
  };
}

export function computeUnitPrice(p: ProductPurchase): number {
  const q = p.quantity || 1;
  const paid = (p.total_price || 0) - (p.points || 0);
  return q > 0 ? paid / q : 0;
}

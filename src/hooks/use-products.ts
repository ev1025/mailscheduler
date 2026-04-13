"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types";
import { useCurrentUserId } from "@/lib/current-user";

export function useProducts() {
  const userId = useCurrentUserId();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("products")
      .select("*")
      .order("is_active", { ascending: false })
      .order("category")
      .order("name");
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) {
      const fallback = await supabase
        .from("products")
        .select("*")
        .order("is_active", { ascending: false })
        .order("category")
        .order("name");
      if (fallback.data) setProducts(fallback.data as Product[]);
    } else if (data) {
      setProducts(data as Product[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addProduct = async (
    item: Omit<Product, "id" | "created_at" | "updated_at">
  ) => {
    const { data, error } = await supabase
      .from("products")
      .insert({ ...item, user_id: userId })
      .select()
      .single();
    if (error) {
      const retry = await supabase
        .from("products")
        .insert(item)
        .select()
        .single();
      if (!retry.error) await fetchProducts();
      return { data: retry.data as Product | null, error: retry.error };
    }
    await fetchProducts();
    return { data: data as Product | null, error: null };
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const { error } = await supabase
      .from("products")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) await fetchProducts();
    return { error };
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) await fetchProducts();
    return { error };
  };

  return {
    products,
    loading,
    addProduct,
    updateProduct,
    deleteProduct,
    refetch: fetchProducts,
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Supplement } from "@/types";

export function useSupplements() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSupplements = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("supplements")
      .select("*")
      .order("ranking", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (!error && data) setSupplements(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSupplements();
  }, [fetchSupplements]);

  const addSupplement = async (
    supplement: Omit<Supplement, "id" | "created_at" | "updated_at">
  ) => {
    const { error } = await supabase.from("supplements").insert(supplement);
    if (!error) await fetchSupplements();
    return { error };
  };

  const updateSupplement = async (
    id: string,
    updates: Partial<Omit<Supplement, "id" | "created_at" | "updated_at">>
  ) => {
    const { error } = await supabase
      .from("supplements")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) await fetchSupplements();
    return { error };
  };

  const deleteSupplement = async (id: string) => {
    const { error } = await supabase
      .from("supplements")
      .delete()
      .eq("id", id);
    if (!error) await fetchSupplements();
    return { error };
  };

  return {
    supplements,
    loading,
    addSupplement,
    updateSupplement,
    deleteSupplement,
    refetch: fetchSupplements,
  };
}

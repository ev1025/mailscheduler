"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TravelPlanTask } from "@/types";

// 특정 plan_id 의 travel_plan_tasks CRUD.
// 정렬 기준: day_index → start_time(있으면) → manual_order.

export function useTravelPlanTasks(planId: string | null) {
  const [tasks, setTasks] = useState<TravelPlanTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!planId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("travel_plan_tasks")
      .select("*")
      .eq("plan_id", planId)
      .order("day_index", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false })
      .order("manual_order", { ascending: true });
    setTasks((data as TravelPlanTask[]) ?? []);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async (input: Omit<TravelPlanTask, "id" | "created_at">) => {
    const { data, error } = await supabase
      .from("travel_plan_tasks")
      .insert(input)
      .select("*")
      .single();
    if (!error) await fetchTasks();
    return { data, error };
  };

  const updateTask = async (id: string, updates: Partial<TravelPlanTask>) => {
    const { error } = await supabase
      .from("travel_plan_tasks")
      .update(updates)
      .eq("id", id);
    if (!error) await fetchTasks();
    return { error };
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from("travel_plan_tasks").delete().eq("id", id);
    if (!error) await fetchTasks();
    return { error };
  };

  // 여행 항목의 places[] 를 일괄 삽입 (add-to-plan-dialog 용)
  const bulkInsert = async (rows: Omit<TravelPlanTask, "id" | "created_at">[]) => {
    if (rows.length === 0) return { error: null };
    const { error } = await supabase.from("travel_plan_tasks").insert(rows);
    if (!error) await fetchTasks();
    return { error };
  };

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    bulkInsert,
    refetch: fetchTasks,
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useAppSetting(key: string, defaultValue: string) {
  const [value, setValue] = useState<string>(defaultValue);
  const [loading, setLoading] = useState(true);

  const fetchValue = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (data && data.value != null) setValue(String(data.value));
    setLoading(false);
  }, [key]);

  useEffect(() => {
    fetchValue();
  }, [fetchValue]);

  const saveValue = async (next: string) => {
    setValue(next);
    await supabase
      .from("app_settings")
      .upsert({ key, value: next, updated_at: new Date().toISOString() });
  };

  return { value, loading, saveValue, refetch: fetchValue };
}

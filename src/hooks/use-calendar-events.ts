"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CalendarEvent } from "@/types";

export function useCalendarEvents(year: number, month: number) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .gte("start_date", startDate)
      .lt("start_date", endDate)
      .order("start_date")
      .order("sort_order")
      .order("created_at");

    if (!error && data) setEvents(data);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // tag/repeat 필드를 안전하게 분리 (DB에 컬럼이 없을 수 있음)
  function safeData(data: Record<string, unknown>) {
    const { tag, repeat, sort_order, ...rest } = data;
    const result: Record<string, unknown> = { ...rest };
    if (tag !== undefined && tag !== null && tag !== "") result.tag = tag;
    if (repeat !== undefined && repeat !== null && repeat !== "none") result.repeat = repeat;
    if (sort_order !== undefined && sort_order !== null) result.sort_order = sort_order;
    return result;
  }

  const addEvent = async (
    event: Omit<CalendarEvent, "id" | "created_at">
  ) => {
    // 먼저 tag 포함해서 시도, 실패하면 tag 빼고 재시도
    const { error } = await supabase
      .from("calendar_events")
      .insert(safeData(event as Record<string, unknown>));
    if (error) {
      // tag/repeat 컬럼이 없는 경우 빼고 재시도
      const { tag, repeat, sort_order, ...rest } = event;
      const { error: retryError } = await supabase
        .from("calendar_events")
        .insert(rest);
      if (!retryError) await fetchEvents();
      return { error: retryError };
    }
    await fetchEvents();
    return { error: null };
  };

  const updateEvent = async (
    id: string,
    updates: Partial<Omit<CalendarEvent, "id" | "created_at">>
  ) => {
    const { error } = await supabase
      .from("calendar_events")
      .update(safeData(updates as Record<string, unknown>))
      .eq("id", id);
    if (error) {
      const { tag, repeat, sort_order, ...rest } = updates;
      const { error: retryError } = await supabase
        .from("calendar_events")
        .update(rest)
        .eq("id", id);
      if (!retryError) await fetchEvents();
      return { error: retryError };
    }
    await fetchEvents();
    return { error: null };
  };

  const deleteEvent = async (id: string) => {
    // 먼저 이벤트 정보 조회 (여행 항목 연동 해제용)
    const { data: ev } = await supabase
      .from("calendar_events")
      .select("title, start_date")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id);

    if (!error && ev) {
      // 동일 제목의 travel_items 중 visited_dates에 해당 날짜가 포함된 항목에서 날짜 제거
      const { data: travelMatches } = await supabase
        .from("travel_items")
        .select("id, visited_dates")
        .eq("title", ev.title);

      if (travelMatches) {
        for (const item of travelMatches as { id: string; visited_dates: string[] | null }[]) {
          if (item.visited_dates && item.visited_dates.includes(ev.start_date)) {
            const next = item.visited_dates.filter((d) => d !== ev.start_date);
            await supabase
              .from("travel_items")
              .update({
                visited_dates: next.length > 0 ? next : null,
                visited: next.length > 0,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id);
          }
        }
      }
    }

    if (!error) await fetchEvents();
    return { error };
  };

  // 순서 일괄 업데이트 (fetch 1회만)
  const batchUpdateSortOrder = async (ids: string[]) => {
    await Promise.all(
      ids.map((id, i) =>
        supabase.from("calendar_events").update({ sort_order: i }).eq("id", id)
      )
    );
    await fetchEvents();
  };

  return { events, loading, addEvent, updateEvent, deleteEvent, batchUpdateSortOrder, refetch: fetchEvents };
}

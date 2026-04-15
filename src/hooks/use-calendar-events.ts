"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CalendarEvent } from "@/types";
import { useCurrentUserId } from "@/lib/current-user";

export interface SharedEvent extends CalendarEvent {
  user_id?: string | null;
  shared_with?: string[] | null;
  shared_accepted_by?: string[] | null;
}

/**
 * visibleUserIds: 캘린더 상단에서 토글로 선택된 "어떤 사용자의 일정을 볼지"
 *  - 나 자신 (currentUserId) : 내가 만든 일정
 *  - 다른 사용자: 내가 수락한 그 사람 공유 일정만
 *  - 아무도 선택 안 하면 → 빈 캘린더
 */
export function useCalendarEvents(
  year: number,
  month: number,
  visibleUserIds: string[] = []
) {
  const currentUserId = useCurrentUserId();
  const [events, setEvents] = useState<SharedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    if (!currentUserId || visibleUserIds.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }
    // visibleUserIds는 이미 상위(useCalendarShares)에서 "볼 수 있는 권한이 있는" 사용자만 포함
    const { data } = await supabase
      .from("calendar_events")
      .select("*")
      .in("user_id", visibleUserIds)
      .gte("start_date", startDate)
      .lt("start_date", endDate)
      .order("start_date")
      .order("sort_order")
      .order("created_at");
    setEvents((data as SharedEvent[]) || []);
    setLoading(false);
  }, [startDate, endDate, visibleUserIds, currentUserId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function safeData(data: Record<string, unknown>) {
    const { tag, repeat, sort_order, shared_with, shared_accepted_by, ...rest } =
      data;
    const result: Record<string, unknown> = { ...rest };
    if (tag !== undefined && tag !== null && tag !== "") result.tag = tag;
    if (repeat !== undefined && repeat !== null && repeat !== "none")
      result.repeat = repeat;
    if (sort_order !== undefined && sort_order !== null)
      result.sort_order = sort_order;
    if (shared_with !== undefined) result.shared_with = shared_with;
    if (shared_accepted_by !== undefined)
      result.shared_accepted_by = shared_accepted_by;
    return result;
  }

  const addEvent = async (
    event: Omit<CalendarEvent, "id" | "created_at"> & {
      shared_with?: string[] | null;
    }
  ) => {
    const payload = {
      ...event,
      user_id: currentUserId,
    };
    const { error } = await supabase
      .from("calendar_events")
      .insert(safeData(payload as Record<string, unknown>));
    if (error) {
      const { tag, repeat, sort_order, shared_with, ...rest } = event;
      void tag;
      void repeat;
      void sort_order;
      void shared_with;
      const { error: retryError } = await supabase
        .from("calendar_events")
        .insert(rest);
      if (!retryError) await fetchEvents();
      return { error: retryError };
    }
    await fetchEvents();
    return { error: null };
  };

  const addEventsBulk = async (
    eventsToAdd: (Omit<CalendarEvent, "id" | "created_at"> & {
      shared_with?: string[] | null;
    })[]
  ) => {
    if (eventsToAdd.length === 0) return { error: null };
    const payloads = eventsToAdd.map((ev) =>
      safeData({ ...ev, user_id: currentUserId } as Record<string, unknown>)
    );
    const { error } = await supabase.from("calendar_events").insert(payloads);
    if (error) {
      const fallback = eventsToAdd.map((ev) => {
        const { tag, repeat, sort_order, shared_with, ...rest } = ev;
        void tag;
        void repeat;
        void sort_order;
        void shared_with;
        return { ...rest, user_id: currentUserId };
      });
      const { error: retryError } = await supabase
        .from("calendar_events")
        .insert(fallback);
      if (!retryError) await fetchEvents();
      return { error: retryError };
    }
    await fetchEvents();
    return { error: null };
  };

  const updateEvent = async (
    id: string,
    updates: Partial<Omit<CalendarEvent, "id" | "created_at">> & {
      shared_with?: string[] | null;
    }
  ) => {
    const { error } = await supabase
      .from("calendar_events")
      .update(safeData(updates as Record<string, unknown>))
      .eq("id", id);
    if (error) {
      const { tag, repeat, sort_order, shared_with, ...rest } = updates;
      void tag;
      void repeat;
      void sort_order;
      void shared_with;
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
      const { data: travelMatches } = await supabase
        .from("travel_items")
        .select("id, visited_dates")
        .eq("title", ev.title);

      if (travelMatches) {
        for (const item of travelMatches as {
          id: string;
          visited_dates: string[] | null;
        }[]) {
          if (
            item.visited_dates &&
            item.visited_dates.includes(ev.start_date)
          ) {
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

  const batchUpdateSortOrder = async (ids: string[]) => {
    await Promise.all(
      ids.map((id, i) =>
        supabase
          .from("calendar_events")
          .update({ sort_order: i })
          .eq("id", id)
      )
    );
    await fetchEvents();
  };

  return {
    events,
    loading,
    addEvent,
    addEventsBulk,
    updateEvent,
    deleteEvent,
    batchUpdateSortOrder,
    refetch: fetchEvents,
  };
}

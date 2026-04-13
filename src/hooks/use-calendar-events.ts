"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CalendarEvent } from "@/types";
import { useCurrentUserId, useAppUsers } from "@/lib/current-user";
import { notifyUsers } from "./use-notifications";

export interface SharedEvent extends CalendarEvent {
  user_id?: string | null;
  shared_with?: string[] | null;
}

export function useCalendarEvents(
  year: number,
  month: number,
  visibleUserIds: string[] = []
) {
  const currentUserId = useCurrentUserId();
  const { users } = useAppUsers();
  const [events, setEvents] = useState<SharedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    if (visibleUserIds.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .gte("start_date", startDate)
      .lt("start_date", endDate)
      .in("user_id", visibleUserIds)
      .order("start_date")
      .order("sort_order")
      .order("created_at");

    if (error) {
      // user_id 컬럼이 아직 없는 경우 fallback
      const fallback = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_date", startDate)
        .lt("start_date", endDate)
        .order("start_date")
        .order("sort_order")
        .order("created_at");
      if (fallback.data) setEvents(fallback.data as SharedEvent[]);
    } else if (data) {
      setEvents(data as SharedEvent[]);
    }
    setLoading(false);
  }, [startDate, endDate, visibleUserIds]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function safeData(data: Record<string, unknown>) {
    const { tag, repeat, sort_order, shared_with, ...rest } = data;
    const result: Record<string, unknown> = { ...rest };
    if (tag !== undefined && tag !== null && tag !== "") result.tag = tag;
    if (repeat !== undefined && repeat !== null && repeat !== "none")
      result.repeat = repeat;
    if (sort_order !== undefined && sort_order !== null)
      result.sort_order = sort_order;
    if (shared_with !== undefined) result.shared_with = shared_with;
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

    // 공유 대상에게 알림
    const sharedWith = event.shared_with || [];
    if (sharedWith.length && currentUserId) {
      const actorName =
        users.find((u) => u.id === currentUserId)?.name || "누군가";
      await notifyUsers(
        sharedWith,
        currentUserId,
        "event_shared",
        `${actorName}님이 일정을 공유했어요`,
        event.title,
        "/calendar"
      );
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
    updateEvent,
    deleteEvent,
    batchUpdateSortOrder,
    refetch: fetchEvents,
  };
}

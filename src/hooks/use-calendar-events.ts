"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CalendarEvent } from "@/types";
import { useCurrentUserId, useAppUsers } from "@/lib/current-user";
import { notifyUsers } from "./use-notifications";

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
    if (!currentUserId || visibleUserIds.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }

    // 내 이벤트 (내가 토글 선택한 경우만)
    const myEvents: SharedEvent[] = [];
    if (visibleUserIds.includes(currentUserId)) {
      const { data } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", currentUserId)
        .gte("start_date", startDate)
        .lt("start_date", endDate)
        .order("start_date")
        .order("sort_order")
        .order("created_at");
      if (data) myEvents.push(...(data as SharedEvent[]));
    }

    // 다른 사용자들의 이벤트 중 "내가 수락한" 것
    const otherIds = visibleUserIds.filter((id) => id !== currentUserId);
    const sharedEvents: SharedEvent[] = [];
    if (otherIds.length > 0) {
      const { data } = await supabase
        .from("calendar_events")
        .select("*")
        .in("user_id", otherIds)
        .contains("shared_accepted_by", [currentUserId])
        .gte("start_date", startDate)
        .lt("start_date", endDate)
        .order("start_date");
      if (data) sharedEvents.push(...(data as SharedEvent[]));
    }

    setEvents([...myEvents, ...sharedEvents]);
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
    const { data, error } = await supabase
      .from("calendar_events")
      .insert(safeData(payload as Record<string, unknown>))
      .select("id")
      .single();
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

    // 공유 대상에게 "수락 요청" 알림
    const sharedWith = event.shared_with || [];
    if (sharedWith.length && currentUserId && data) {
      const actorName =
        users.find((u) => u.id === currentUserId)?.name || "누군가";
      await notifyUsers(
        sharedWith,
        currentUserId,
        "event_share_request",
        `${actorName}님이 일정을 공유했어요`,
        event.title,
        `/calendar?accept=${data.id}`
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

  // 공유 수락: shared_accepted_by에 내 id 추가
  const acceptShare = async (eventId: string) => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from("calendar_events")
      .select("shared_accepted_by")
      .eq("id", eventId)
      .single();
    const existing = (data?.shared_accepted_by as string[] | null) || [];
    if (existing.includes(currentUserId)) return;
    await supabase
      .from("calendar_events")
      .update({ shared_accepted_by: [...existing, currentUserId] })
      .eq("id", eventId);
    await fetchEvents();
  };

  // 공유 거절: 아무 일도 안 함 (또는 shared_with에서 빼기)
  const rejectShare = async (eventId: string) => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from("calendar_events")
      .select("shared_with")
      .eq("id", eventId)
      .single();
    const existing = (data?.shared_with as string[] | null) || [];
    const next = existing.filter((id) => id !== currentUserId);
    await supabase
      .from("calendar_events")
      .update({ shared_with: next.length > 0 ? next : null })
      .eq("id", eventId);
  };

  return {
    events,
    loading,
    addEvent,
    updateEvent,
    deleteEvent,
    batchUpdateSortOrder,
    acceptShare,
    rejectShare,
    refetch: fetchEvents,
  };
}

/**
 * 내가 공유자로서(owner) 공유한 사람 + 나를 공유 대상으로 지정해 내가 수락한 owner 목록
 * → 캘린더 상단 사용자 토글에 노출할 ID들
 */
export async function fetchRelatedUserIds(
  currentUserId: string
): Promise<string[]> {
  const set = new Set<string>([currentUserId]);

  // 내가 공유한 이벤트의 shared_accepted_by에 있는 사람들
  const { data: owned } = await supabase
    .from("calendar_events")
    .select("shared_accepted_by")
    .eq("user_id", currentUserId)
    .not("shared_accepted_by", "is", null);
  if (owned) {
    for (const row of owned as { shared_accepted_by: string[] | null }[]) {
      (row.shared_accepted_by || []).forEach((id) => set.add(id));
    }
  }

  // 다른 사람이 공유했고 내가 수락한 이벤트의 user_id
  const { data: accepted } = await supabase
    .from("calendar_events")
    .select("user_id")
    .contains("shared_accepted_by", [currentUserId]);
  if (accepted) {
    for (const row of accepted as { user_id: string | null }[]) {
      if (row.user_id) set.add(row.user_id);
    }
  }

  return Array.from(set);
}

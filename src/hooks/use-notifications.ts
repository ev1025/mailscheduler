"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUserId } from "@/lib/current-user";

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const userId = useCurrentUserId();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setNotifications(data as AppNotification[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
    if (!userId) return;
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications, userId]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    await fetchNotifications();
  };

  const markAllRead = async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    await fetchNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllRead,
    refetch: fetchNotifications,
  };
}

export async function notifyUsers(
  userIds: string[],
  actorId: string | null,
  type: string,
  title: string,
  body?: string,
  link?: string
) {
  if (!userIds.length) return;
  const rows = userIds
    .filter((id) => id !== actorId)
    .map((uid) => ({
      user_id: uid,
      actor_id: actorId,
      type,
      title,
      body: body || null,
      link: link || null,
    }));
  if (!rows.length) return;
  await supabase.from("notifications").insert(rows);
}

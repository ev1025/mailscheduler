"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUserId, useAppUsers } from "@/lib/current-user";
import { notifyUsers } from "./use-notifications";

export interface CalendarShare {
  id: string;
  owner_id: string;
  viewer_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

export function useCalendarShares() {
  const currentUserId = useCurrentUserId();
  const { users } = useAppUsers();
  const [shares, setShares] = useState<CalendarShare[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShares = useCallback(async () => {
    if (!currentUserId) {
      setShares([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("calendar_shares")
      .select("*")
      .or(`owner_id.eq.${currentUserId},viewer_id.eq.${currentUserId}`);
    if (!error && data) setShares(data as CalendarShare[]);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  // 내가 공유한 사람 목록 (내가 owner)
  const outgoing = shares.filter((s) => s.owner_id === currentUserId);
  // 나에게 공유 제안이 온 목록 (내가 viewer)
  const incoming = shares.filter((s) => s.viewer_id === currentUserId);

  // 내가 볼 수 있는 사용자 (수락된 공유자 owner들 + 나 자신)
  const viewableUserIds = Array.from(
    new Set([
      ...(currentUserId ? [currentUserId] : []),
      ...incoming
        .filter((s) => s.status === "accepted")
        .map((s) => s.owner_id),
    ])
  );

  const invite = async (viewerId: string) => {
    if (!currentUserId || viewerId === currentUserId) return { error: "self" };
    // 이미 초대됐는지 확인
    const existing = outgoing.find((s) => s.viewer_id === viewerId);
    if (existing) {
      return { error: "already invited" };
    }
    const { error } = await supabase.from("calendar_shares").insert({
      owner_id: currentUserId,
      viewer_id: viewerId,
      status: "pending",
    });
    if (error) return { error };

    const myName = users.find((u) => u.id === currentUserId)?.name || "누군가";
    await notifyUsers(
      [viewerId],
      currentUserId,
      "calendar_share_request",
      `${myName}님이 캘린더를 공유했어요`,
      "수락하면 상대 일정이 내 캘린더에 표시됩니다",
      `/calendar`
    );

    await fetchShares();
    return { error: null };
  };

  const accept = async (shareId: string) => {
    const { error } = await supabase
      .from("calendar_shares")
      .update({ status: "accepted" })
      .eq("id", shareId);
    if (!error) await fetchShares();
    return { error };
  };

  const reject = async (shareId: string) => {
    const { error } = await supabase
      .from("calendar_shares")
      .update({ status: "rejected" })
      .eq("id", shareId);
    if (!error) await fetchShares();
    return { error };
  };

  const cancel = async (shareId: string) => {
    const { error } = await supabase
      .from("calendar_shares")
      .delete()
      .eq("id", shareId);
    if (!error) await fetchShares();
    return { error };
  };

  return {
    shares,
    outgoing,
    incoming,
    viewableUserIds,
    loading,
    invite,
    accept,
    reject,
    cancel,
    refetch: fetchShares,
  };
}

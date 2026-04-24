"use client";

import { useEffect, useState } from "react";
import { useCurrentUserId } from "@/lib/current-user";

// 캘린더/여행/여행계획이 공유하는 "보이는 사용자" 필터.
// localStorage 에 영속 → 페이지 간 이동·새로고침 시에도 유지.
const VISIBLE_KEY = "calendar_visible_user_ids";

export function useVisibleUserIds() {
  const currentUserId = useCurrentUserId();

  const [visibleUserIds, setVisibleUserIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(VISIBLE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  // 최초 1회: 저장된 값 없으면 내 ID로 기본
  useEffect(() => {
    if (currentUserId && visibleUserIds.length === 0) {
      setVisibleUserIds([currentUserId]);
    }
  }, [currentUserId, visibleUserIds.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (visibleUserIds.length > 0) {
      try {
        localStorage.setItem(VISIBLE_KEY, JSON.stringify(visibleUserIds));
      } catch {}
    }
  }, [visibleUserIds]);

  const toggleVisible = (uid: string) => {
    setVisibleUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  return { visibleUserIds, setVisibleUserIds, toggleVisible };
}

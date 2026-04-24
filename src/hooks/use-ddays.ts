"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CalendarEvent, TravelPlan } from "@/types";

// D-day 리스트 — calendar_events(is_dday=true) + travel_plans(start_date 존재)
// 를 합쳐서 오늘 기준 가까운 순으로 정렬.
// "가까운 순": 아직 안 온 날짜 오름차순 먼저, 지난 날짜는 최근 순서로 뒤.

export type DdayKind = "event" | "travel";
export interface DdayItem {
  id: string;
  kind: DdayKind;
  label: string;       // 위젯에 표시할 짧은 텍스트
  fullTitle: string;   // 원본 제목 (툴팁·이동용)
  date: string;        // YYYY-MM-DD
  days: number;        // +n: 미래, 0: 오늘, -n: 지남
  color?: string;
}

// 오늘 자정(로컬) 기준 차이 일수 — 시간대 영향 최소화.
function daysBetween(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function formatDdayLabel(days: number): string {
  if (days === 0) return "D-DAY";
  if (days > 0) return `D-${days}`;
  return `D+${Math.abs(days)}`;
}

export function useDdays(visibleUserIds?: string[]): {
  items: DdayItem[];
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const [items, setItems] = useState<DdayItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // 캘린더 이벤트 — is_dday=true 만
      let eventQ = supabase
        .from("calendar_events")
        .select("*")
        .eq("is_dday", true);
      if (visibleUserIds && visibleUserIds.length > 0) {
        eventQ = eventQ.in("user_id", visibleUserIds);
      }
      const evRes = await eventQ;
      // 칼럼 미존재 환경 대응 — 조용히 무시 (SQL 마이그레이션 전 fallback).
      const events: CalendarEvent[] = evRes.error ? [] : (evRes.data ?? []);

      // 여행 계획 — start_date 있는 것만
      let planQ = supabase
        .from("travel_plans")
        .select("*")
        .not("start_date", "is", null);
      if (visibleUserIds && visibleUserIds.length > 0) {
        planQ = planQ.in("user_id", visibleUserIds);
      }
      const planRes = await planQ;
      const plans: TravelPlan[] = planRes.error ? [] : (planRes.data ?? []);

      const merged: DdayItem[] = [];

      for (const ev of events) {
        const days = daysBetween(ev.start_date);
        merged.push({
          id: `event:${ev.id}`,
          kind: "event",
          label: ev.dday_label?.trim() || ev.title,
          fullTitle: ev.title,
          date: ev.start_date,
          days,
          color: ev.color,
        });
      }

      for (const pl of plans) {
        if (!pl.start_date) continue;
        const days = daysBetween(pl.start_date);
        merged.push({
          id: `plan:${pl.id}`,
          kind: "travel",
          label: pl.title,
          fullTitle: pl.title,
          date: pl.start_date,
          days,
        });
      }

      // 정렬: 오늘 이후 가까운 것 먼저 (오름차순), 그 후 지난 것 (최근 순)
      merged.sort((a, b) => {
        const aF = a.days >= 0;
        const bF = b.days >= 0;
        if (aF && !bF) return -1;
        if (!aF && bF) return 1;
        if (aF) return a.days - b.days;            // 둘 다 미래·오늘 → 가까운 순
        return b.days - a.days;                     // 둘 다 지남 → 최근 지난 순
      });

      setItems(merged);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // 자정 지나면 days 재계산 — 간단히 1분마다 폴링.
    const t = setInterval(fetchAll, 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(visibleUserIds ?? [])]);

  return { items, loading, refetch: fetchAll };
}

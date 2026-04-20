"use client";

import { useEffect, useState } from "react";
import { fetchRouteDuration, type RouteResult } from "@/lib/travel/providers";
import type { TransportMode } from "@/types";

// 좌표·수단 조합 기반 route 결과 캐시.
// - 모듈 레벨 Map 으로 모든 컴포넌트 공유 (탭 간 일관성)
// - TTL 2분 — 네이버 Directions 5 일일 한도(6만건) 대비 여유 + 실제 교통상황
//   반영은 포기 (대신 사용자가 picker 닫았다 다시 열어도 즉시 표시)
// - key = "fromLat,fromLng|toLat,toLng|mode" — 좌표·수단 바뀌면 자동 갱신
//
// 이전 구조: picker 열 때마다 4모드 호출 + DB jsonb 캐시를 시도했으나
//   DB 캐시는 invalidation 규칙이 복잡해 (모드 변경·실패값·좌표 변경)
//   임기응변이 되어 29분 버그 같은 정상/비정상 구분 어려움.
//
// 현 설계: DB 는 "선택된 수단의 확정 duration" 만 저장 (user's choice 로그).
// in-memory 캐시가 세션 단위 조회 최적화 담당.

const CACHE_TTL_MS = 2 * 60 * 1000;

interface CacheEntry {
  result: RouteResult | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<RouteResult | null>>();

function keyOf(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TransportMode
): string {
  const r = (n: number) => Math.round(n * 1e5) / 1e5; // 좌표 해시 — 소수 5자리
  return `${r(from.lat)},${r(from.lng)}|${r(to.lat)},${r(to.lng)}|${mode}`;
}

export async function getRouteData(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TransportMode
): Promise<RouteResult | null> {
  const key = keyOf(from, to, mode);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.result;

  // 동일 key 에 대해 이미 진행 중인 요청 있으면 그 promise 공유
  const existing = pending.get(key);
  if (existing) return existing;

  const p = fetchRouteDuration(from, to, mode)
    .then((result) => {
      cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, p);
  return p;
}

// 특정 좌표쌍의 모든 모드 결과 무효화 — 좌표 변경 시 호출
export function invalidateRouteData(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) {
  const prefix = `${Math.round(from.lat * 1e5) / 1e5},${Math.round(from.lng * 1e5) / 1e5}|${
    Math.round(to.lat * 1e5) / 1e5
  },${Math.round(to.lng * 1e5) / 1e5}|`;
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

// 4개 수단 병렬 fetch. picker 오픈 시 한 번에 로드용.
export function useRouteDurations(
  from: { lat: number; lng: number } | null,
  to: { lat: number; lng: number } | null,
  enabled: boolean
) {
  const [durations, setDurations] = useState<Record<TransportMode, number | null | "loading">>(() => ({
    walk: "loading",
    car: "loading",
    bus: "loading",
    train: "loading",
    taxi: null,
  }));

  useEffect(() => {
    if (!enabled || !from || !to) return;
    let cancelled = false;

    // 이미 캐시된 것 먼저 반영, 나머지만 fetch
    const modes: TransportMode[] = ["walk", "car", "bus", "train"];
    const initial: Partial<Record<TransportMode, number | null | "loading">> = {};
    for (const m of modes) {
      const key = keyOf(from, to, m);
      const hit = cache.get(key);
      if (hit && hit.expiresAt > Date.now()) {
        initial[m] = hit.result?.durationSec ?? null;
      } else {
        initial[m] = "loading";
      }
    }
    setDurations((prev) => ({ ...prev, ...initial, taxi: null }));

    (async () => {
      const results = await Promise.all(
        modes.map((m) =>
          getRouteData(from, to, m)
            .then((r) => [m, r?.durationSec ?? null] as const)
            .catch(() => [m, null] as const)
        )
      );
      if (cancelled) return;
      setDurations((prev) => {
        const next = { ...prev };
        for (const [m, sec] of results) next[m] = sec;
        return next;
      });
    })();

    return () => { cancelled = true; };
  }, [enabled, from?.lat, from?.lng, to?.lat, to?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return durations;
}

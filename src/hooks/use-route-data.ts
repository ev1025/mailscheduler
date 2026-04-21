"use client";

import { useEffect, useState } from "react";
import { fetchRouteDetailed, type RouteResult, type RouteError } from "@/lib/travel/providers";
import type { TransportMode } from "@/types";

// 좌표·수단 조합 기반 route 결과 캐시.
// - 모듈 레벨 Map 으로 모든 컴포넌트 공유
// - 성공 결과만 2분 TTL 캐시. 실패(null)는 캐시하지 않아 재시도 가능
// - key = "fromLat,fromLng|toLat,toLng|mode" — 좌표·수단 바뀌면 자동 갱신
// - error 정보도 함께 반환해 UI 가 실패 원인 표시 가능

const CACHE_TTL_MS = 2 * 60 * 1000;

interface CacheEntry {
  result: RouteResult | null;
  error?: RouteError;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<CacheEntry>>();

function keyOf(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TransportMode
): string {
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return `${r(from.lat)},${r(from.lng)}|${r(to.lat)},${r(to.lng)}|${mode}`;
}

export async function getRouteData(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TransportMode
): Promise<RouteResult | null> {
  const entry = await getRouteEntry(from, to, mode);
  return entry.result;
}

async function getRouteEntry(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TransportMode
): Promise<CacheEntry> {
  const key = keyOf(from, to, mode);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now && hit.result) return hit;

  const existing = pending.get(key);
  if (existing) return existing;

  const p = fetchRouteDetailed(from, to, mode)
    .then(({ result, error }) => {
      const entry: CacheEntry = { result, error, expiresAt: Date.now() + CACHE_TTL_MS };
      // 성공일 때만 캐시 — 실패는 즉시 재시도 가능하도록
      if (result) cache.set(key, entry);
      return entry;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, p);
  return p;
}

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

export interface RouteResultsMap {
  durations: Record<TransportMode, number | null | "loading">;
  results: Partial<Record<TransportMode, RouteResult | null>>;
  /** 실패한 수단별 에러 정보 — UI 에서 실패 사유 표시용 */
  errors: Partial<Record<TransportMode, RouteError | undefined>>;
}

export function useRouteDurations(
  from: { lat: number; lng: number } | null,
  to: { lat: number; lng: number } | null,
  enabled: boolean
): RouteResultsMap {
  const [state, setState] = useState<RouteResultsMap>(() => ({
    durations: {
      walk: "loading",
      car: "loading",
      bus: "loading",
      train: "loading",
      taxi: null,
    },
    results: {},
    errors: {},
  }));

  useEffect(() => {
    if (!enabled || !from || !to) return;
    let cancelled = false;

    const modes: TransportMode[] = ["walk", "car", "bus", "train"];
    const initialDur: Partial<Record<TransportMode, number | null | "loading">> = {};
    const initialRes: Partial<Record<TransportMode, RouteResult | null>> = {};
    const initialErr: Partial<Record<TransportMode, RouteError | undefined>> = {};
    for (const m of modes) {
      const key = keyOf(from, to, m);
      const hit = cache.get(key);
      if (hit && hit.expiresAt > Date.now() && hit.result) {
        initialDur[m] = hit.result.durationSec;
        initialRes[m] = hit.result;
      } else {
        initialDur[m] = "loading";
      }
    }
    setState((prev) => ({
      durations: { ...prev.durations, ...initialDur, taxi: null },
      results: { ...prev.results, ...initialRes },
      errors: { ...prev.errors, ...initialErr },
    }));

    (async () => {
      const entries = await Promise.all(
        modes.map((m) =>
          getRouteEntry(from, to, m)
            .then((e) => [m, e] as const)
            .catch((err) => [m, { result: null, error: { code: "NETWORK", message: String(err) }, expiresAt: 0 } as CacheEntry] as const)
        )
      );
      if (cancelled) return;
      setState((prev) => {
        const nextDur = { ...prev.durations };
        const nextRes = { ...prev.results };
        const nextErr = { ...prev.errors };
        for (const [m, e] of entries) {
          nextDur[m] = e.result?.durationSec ?? null;
          nextRes[m] = e.result;
          nextErr[m] = e.error;
        }
        return { durations: nextDur, results: nextRes, errors: nextErr };
      });
    })();

    return () => { cancelled = true; };
  }, [enabled, from?.lat, from?.lng, to?.lat, to?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

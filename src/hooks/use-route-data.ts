"use client";

import { useEffect, useState } from "react";
import { fetchRouteDetailed, type RouteResult, type RouteError } from "@/lib/travel/providers";
import type { TransportMode } from "@/types";

// 좌표·수단 조합 기반 route 결과 캐시 — 메모리 + localStorage 2단계, 24시간 TTL.
//
// - L1 메모리 Map: 세션 내 빠른 재조회
// - L2 localStorage: 24시간 영구 저장. 새로고침·다음 세션에도 유지.
// - 24시간 후 자동 무효화 → Google/NCP 노선 변경·교통상황 대응
// - 성공 결과만 저장. 실패(null)는 캐시 안 함 → 재시도 즉시 가능
// - 스키마 변경 대비 버전 키(v2) — 증가 시 이전 항목 자동 무시

const MEM_TTL_MS = 5 * 60 * 1000;               // 메모리 5분
const LS_TTL_MS = 24 * 60 * 60 * 1000;          // 로컬 24시간
const LS_VERSION = "v2";
const LS_PREFIX = `rtc:${LS_VERSION}:`;

interface CacheEntry {
  result: RouteResult | null;
  error?: RouteError;
  expiresAt: number;
}

interface StoredEntry {
  result: RouteResult;
  savedAt: number;
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

function lsGet(key: string): RouteResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as StoredEntry;
    if (!entry || typeof entry.savedAt !== "number") return null;
    if (Date.now() - entry.savedAt > LS_TTL_MS) {
      localStorage.removeItem(LS_PREFIX + key);
      return null;
    }
    return entry.result;
  } catch {
    return null;
  }
}

function lsSet(key: string, result: RouteResult) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LS_PREFIX + key,
      JSON.stringify({ result, savedAt: Date.now() } satisfies StoredEntry)
    );
  } catch {
    // quota 초과 시 가장 오래된 절반 삭제 후 재시도
    try {
      const items: { k: string; t: number }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(LS_PREFIX)) continue;
        try {
          const v = JSON.parse(localStorage.getItem(k) ?? "{}") as StoredEntry;
          items.push({ k, t: v.savedAt ?? 0 });
        } catch {
          /* skip */
        }
      }
      items.sort((a, b) => a.t - b.t);
      for (const { k } of items.slice(0, Math.ceil(items.length / 2))) {
        localStorage.removeItem(k);
      }
      localStorage.setItem(
        LS_PREFIX + key,
        JSON.stringify({ result, savedAt: Date.now() } satisfies StoredEntry)
      );
    } catch {
      /* 포기 */
    }
  }
}

function lsRemovePrefix(prefix: string) {
  if (typeof window === "undefined") return;
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LS_PREFIX + prefix)) toDelete.push(k);
    }
    for (const k of toDelete) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
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

  // L1 메모리
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now && hit.result) return hit;

  // L2 localStorage → 메모리 승격
  const fromLs = lsGet(key);
  if (fromLs) {
    const entry: CacheEntry = { result: fromLs, expiresAt: now + MEM_TTL_MS };
    cache.set(key, entry);
    return entry;
  }

  // 동일 키 요청 공유
  const existing = pending.get(key);
  if (existing) return existing;

  const p = fetchRouteDetailed(from, to, mode)
    .then(({ result, error }) => {
      const entry: CacheEntry = { result, error, expiresAt: Date.now() + MEM_TTL_MS };
      if (result) {
        cache.set(key, entry);
        lsSet(key, result);
      }
      return entry;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, p);
  return p;
}

// 좌표쌍의 모든 수단 결과 무효화 (메모리 + 로컬 모두). 위치 변경 시 호출.
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
  lsRemovePrefix(prefix);
}

export interface RouteResultsMap {
  durations: Record<TransportMode, number | null | "loading">;
  results: Partial<Record<TransportMode, RouteResult | null>>;
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

    // 메모리·로컬 히트 먼저 반영해 즉시 표시 (API 호출 없이)
    for (const m of modes) {
      const key = keyOf(from, to, m);
      const memHit = cache.get(key);
      if (memHit && memHit.expiresAt > Date.now() && memHit.result) {
        initialDur[m] = memHit.result.durationSec;
        initialRes[m] = memHit.result;
        continue;
      }
      const lsHit = lsGet(key);
      if (lsHit) {
        cache.set(key, { result: lsHit, expiresAt: Date.now() + MEM_TTL_MS });
        initialDur[m] = lsHit.durationSec;
        initialRes[m] = lsHit;
        continue;
      }
      initialDur[m] = "loading";
    }
    setState((prev) => ({
      durations: { ...prev.durations, ...initialDur, taxi: null },
      results: { ...prev.results, ...initialRes },
      errors: { ...prev.errors, ...initialErr },
    }));

    // 캐시 없는 수단만 fetch
    const needFetch = modes.filter((m) => initialDur[m] === "loading");
    if (needFetch.length === 0) return;

    (async () => {
      const entries = await Promise.all(
        needFetch.map((m) =>
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

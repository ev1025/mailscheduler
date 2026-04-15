"use client";

import { useCallback, useEffect, useState } from "react";
import type { WeatherData } from "@/types";
import { useWeatherLocation } from "@/hooks/use-weather-location";

const LS_KEY = "weather_cache_v3";

interface CachedEntry {
  data: WeatherData;
  cachedAt: string; // ISO
  type: "past" | "forecast";
}

type Cache = Record<string, CachedEntry>;

function cacheKey(locKey: string) {
  return `${LS_KEY}:${locKey}`;
}

function loadCache(locKey: string): Cache {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(cacheKey(locKey));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCache(locKey: string, cache: Cache) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(locKey), JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function isForecastExpired(cachedAt: string): boolean {
  const cached = new Date(cachedAt);
  const now = new Date();
  const diffHours = (now.getTime() - cached.getTime()) / 3600000;
  return diffHours > 6; // 6시간 지나면 예보 재요청
}

export function useWeather(year: number, month: number) {
  const location = useWeatherLocation();
  const [weatherMap, setWeatherMap] = useState<Record<string, WeatherData>>({});
  const [loading, setLoading] = useState(true);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(
    lastDay
  ).padStart(2, "0")}`;

  const locKey = `${location.lat.toFixed(3)},${location.lon.toFixed(3)}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const cache = loadCache(locKey);
    const today = todayISO();

    // 1) 즉시: 캐시에서 이 달 범위 데이터 보여주기
    const initial: Record<string, WeatherData> = {};
    for (const [date, entry] of Object.entries(cache)) {
      if (date >= startDate && date <= endDate) {
        initial[date] = entry.data;
      }
    }
    setWeatherMap(initial);
    setLoading(false);

    // 2) 백그라운드: 빠진 날짜가 있거나 예보가 오래됐으면 재요청
    const needsRefresh = (() => {
      // 범위 내 오늘 이전 중 캐시 없는 날짜
      const cursor = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T00:00:00");
      while (cursor <= end) {
        const d = cursor.toISOString().split("T")[0];
        const entry = cache[d];
        if (!entry) return true;
        if (entry.type === "forecast" && isForecastExpired(entry.cachedAt)) {
          return true;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      return false;
    })();

    if (!needsRefresh) return;

    try {
      const res = await fetch(
        `/api/weather?start=${startDate}&end=${endDate}&lat=${location.lat}&lon=${location.lon}&country=${location.country}`
      );
      if (!res.ok) return;
      const fresh: Record<string, WeatherData> = await res.json();
      const nowIso = new Date().toISOString();
      const nextCache: Cache = { ...cache };
      const merged: Record<string, WeatherData> = { ...initial };
      for (const [date, data] of Object.entries(fresh)) {
        merged[date] = data;
        nextCache[date] = {
          data,
          cachedAt: nowIso,
          type: date >= today ? "forecast" : "past",
        };
      }
      saveCache(locKey, nextCache);
      setWeatherMap(merged);
    } catch {
      /* 네트워크 실패 시 캐시 그대로 */
    }
  }, [startDate, endDate, locKey, location.lat, location.lon, location.country]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { weatherMap, loading };
}

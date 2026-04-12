"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { WeatherData } from "@/types";

// 예보 캐시 키 (오전/오후 단위)
function getForecastCacheKey(): string {
  const period = new Date().getHours() < 12 ? "AM" : "PM";
  const today = new Date().toISOString().split("T")[0];
  return `weather_forecast_${today}_${period}`;
}

function loadForecastCache(): Record<string, WeatherData> | null {
  try {
    const raw = localStorage.getItem(getForecastCacheKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveForecastCache(data: Record<string, WeatherData>) {
  try {
    // 오래된 예보 캐시 정리
    const currentKey = getForecastCacheKey();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("weather_forecast_") && k !== currentKey) {
        localStorage.removeItem(k);
      }
    }
    localStorage.setItem(currentKey, JSON.stringify(data));
  } catch { /* ignore */ }
}

export function useWeather(year: number, month: number) {
  const [weatherMap, setWeatherMap] = useState<Record<string, WeatherData>>({});
  const [loading, setLoading] = useState(true);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const combined: Record<string, WeatherData> = {};

    // 1) DB에서 과거 날씨 즉시 로드
    try {
      const { data: cached } = await supabase
        .from("weather_cache")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate);
      if (cached) {
        for (const row of cached) combined[row.date] = row;
      }
    } catch { /* ignore */ }

    // 2) localStorage에서 예보 캐시 즉시 병합
    const forecastCache = loadForecastCache();
    if (forecastCache) {
      for (const [date, data] of Object.entries(forecastCache)) {
        if (date >= startDate && date <= endDate) {
          combined[date] = data;
        }
      }
    }

    setWeatherMap({ ...combined });
    setLoading(false);

    // 3) 현재 월에 최근 ~ 미래 날짜가 누락되었는지 확인, 누락 있으면 API 호출
    const today = new Date().toISOString().split("T")[0];
    let hasMissingRecent = false;
    if (endDate >= today) {
      // 오늘 ±7일 범위 중 month 범위 안에서 누락 확인
      for (let i = -7; i <= 16; i++) {
        const d = new Date(Date.now() + i * 86400000).toISOString().split("T")[0];
        if (d >= startDate && d <= endDate && !combined[d]) {
          hasMissingRecent = true;
          break;
        }
      }
    }

    if (!forecastCache || hasMissingRecent) {
      try {
        const res = await fetch(`/api/weather?start=${startDate}&end=${endDate}`);
        if (res.ok) {
          const fresh: Record<string, WeatherData> = await res.json();
          if (Object.keys(fresh).length > 0) {
            const forecastOnly: Record<string, WeatherData> = {};
            for (const [date, data] of Object.entries(fresh)) {
              combined[date] = data;
              if (date >= today) forecastOnly[date] = data;
            }
            saveForecastCache(forecastOnly);
            setWeatherMap({ ...combined });
          }
        }
      } catch { /* ignore */ }
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { weatherMap, loading };
}

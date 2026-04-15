"use client";

import { useEffect, useState } from "react";

export interface WeatherLocation {
  name: string;
  lat: number;
  lon: number;
  country: string; // ISO2 (e.g. "KR", "FR")
}

const KEY = "weather_location";
const DEFAULT: WeatherLocation = {
  name: "서울",
  lat: 37.5665,
  lon: 126.978,
  country: "KR",
};

export function getWeatherLocation(): WeatherLocation {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function setWeatherLocation(loc: WeatherLocation) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(loc));
  window.dispatchEvent(new Event("weather-location-change"));
}

export function useWeatherLocation() {
  const [loc, setLoc] = useState<WeatherLocation>(DEFAULT);
  useEffect(() => {
    setLoc(getWeatherLocation());
    const handler = () => setLoc(getWeatherLocation());
    window.addEventListener("weather-location-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("weather-location-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return loc;
}

export interface GeoResult {
  id: number;
  name: string;
  country: string;
  country_code: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export async function searchLocation(query: string): Promise<GeoResult[]> {
  if (!query.trim()) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=8&language=ko&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results as GeoResult[]) || [];
}

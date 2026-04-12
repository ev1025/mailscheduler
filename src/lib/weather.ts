import type { WeatherData } from "@/types";

export async function fetchWeatherForMonth(year: number, month: number): Promise<WeatherData[]> {
  try {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const res = await fetch(`/api/weather?start=${startDate}&end=${endDate}`);
    if (!res.ok) return [];

    const data: Record<string, WeatherData> = await res.json();
    return Object.values(data);
  } catch {
    return [];
  }
}

export function getWeatherIconUrl(iconCode: string): string {
  return `https://openweathermap.org/img/wn/${iconCode}.png`;
}

"use client";

import { getWeatherIconUrl } from "@/lib/weather";
import type { WeatherData } from "@/types";

interface WeatherIconProps {
  weather: WeatherData;
  compact?: boolean;
  inline?: boolean;
  showRange?: boolean;
}

export default function WeatherIcon({ weather, compact, inline, showRange }: WeatherIconProps) {
  // 일정목록용: 아이콘, 텍스트, 저온/고온
  if (inline) {
    return (
      <div className="flex items-center gap-1 text-[10px] whitespace-nowrap overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getWeatherIconUrl(weather.weather_icon)} alt={weather.weather_description} className="h-4 w-4 shrink-0" />
        <span className="text-muted-foreground truncate">{weather.weather_description}</span>
        <span className="text-blue-500 shrink-0">{weather.temperature_min}°</span>
        <span className="text-muted-foreground shrink-0">/</span>
        <span className="text-red-500 shrink-0">{weather.temperature_max}°</span>
      </div>
    );
  }

  if (compact) {
    // 캘린더 셀용: 아이콘 + 최저/최고 + 설명 (세로)
    return (
      <div className="flex flex-col items-end gap-0 leading-none">
        <div className="flex items-center gap-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getWeatherIconUrl(weather.weather_icon)}
            alt={weather.weather_description}
            className="h-4 w-4"
          />
          <span className="text-[9px] text-blue-500">{weather.temperature_min}°</span>
          <span className="text-[9px] text-muted-foreground">/</span>
          <span className="text-[9px] text-red-500">{weather.temperature_max}°</span>
        </div>
        <span className="text-[8px] text-muted-foreground">{weather.weather_description}</span>
      </div>
    );
  }

  // 일반/상세용
  return (
    <div className="flex items-center gap-1 text-xs">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getWeatherIconUrl(weather.weather_icon)}
        alt={weather.weather_description}
        className="h-6 w-6"
        title={weather.weather_description}
      />
      {showRange ? (
        <span className="text-muted-foreground leading-none">
          <span className="text-blue-500">{weather.temperature_min}°</span>
          {" / "}
          <span className="text-red-500">{weather.temperature_max}°</span>
        </span>
      ) : (
        <span className="text-muted-foreground leading-none">
          {weather.temperature_max}°
        </span>
      )}
      <span className="text-muted-foreground">{weather.weather_description}</span>
    </div>
  );
}

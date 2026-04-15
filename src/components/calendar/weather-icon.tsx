"use client";

import { getWeatherIconUrl } from "@/lib/weather";
import type { WeatherData } from "@/types";

interface WeatherIconProps {
  weather: WeatherData;
  compact?: boolean;
  inline?: boolean;
  showRange?: boolean;
}

export default function WeatherIcon({
  weather,
  compact,
  inline,
  showRange,
}: WeatherIconProps) {
  if (inline) {
    return (
      <div className="flex items-center gap-1 text-xs whitespace-nowrap overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getWeatherIconUrl(weather.weather_icon)}
          alt={weather.weather_description}
          className="h-4 w-4 shrink-0"
        />
        <span className="text-muted-foreground truncate">
          {weather.weather_description}
        </span>
        <span className="text-blue-500 shrink-0">
          {weather.temperature_min}°
        </span>
        <span className="text-muted-foreground shrink-0">/</span>
        <span className="text-red-500 shrink-0">
          {weather.temperature_max}°
        </span>
      </div>
    );
  }

  if (compact) {
    // 공용 컴팩트 뷰 — 모바일/데스크톱 모두 아이콘을 "/" 위에 중앙 배치
    return (
      <div className="flex flex-col items-center gap-0 leading-[1] shrink-0 max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getWeatherIconUrl(weather.weather_icon)}
          alt={weather.weather_description}
          className="h-[14px] w-[14px] md:h-[18px] md:w-[18px] shrink-0 -mb-0.5"
        />
        <div className="flex items-center leading-[1] whitespace-nowrap tabular-nums">
          <span className="text-[8px] md:text-[10px] text-blue-500">
            {weather.temperature_min}°
          </span>
          <span className="text-[8px] md:text-[10px] text-muted-foreground">/</span>
          <span className="text-[8px] md:text-[10px] text-red-500">
            {weather.temperature_max}°
          </span>
        </div>
      </div>
    );
  }

  // 기본 — DayDetail 헤더 등에서 사용. 세로 2줄로 컴팩트하게.
  return (
    <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getWeatherIconUrl(weather.weather_icon)}
        alt={weather.weather_description}
        className="h-5 w-5 shrink-0"
        title={weather.weather_description}
      />
      {showRange ? (
        <span className="leading-none">
          <span className="text-blue-500">{weather.temperature_min}°</span>
          <span className="text-muted-foreground"> / </span>
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

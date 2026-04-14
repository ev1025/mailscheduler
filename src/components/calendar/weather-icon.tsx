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
      <div className="flex items-center gap-1 text-[10px] whitespace-nowrap overflow-hidden">
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
    return (
      <>
        {/* 모바일: 1행 아이콘, 2행 최저/최고 */}
        <div className="flex md:hidden flex-col items-end gap-0 leading-[1] shrink-0 max-w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getWeatherIconUrl(weather.weather_icon)}
            alt={weather.weather_description}
            className="h-3 w-3 shrink-0"
          />
          <div className="flex items-center leading-[1] whitespace-nowrap">
            <span className="text-[7px] text-blue-500">
              {weather.temperature_min}°
            </span>
            <span className="text-[7px] text-muted-foreground">/</span>
            <span className="text-[7px] text-red-500">
              {weather.temperature_max}°
            </span>
          </div>
        </div>
        {/* 데스크톱: 1행 아이콘+설명, 2행 최저/최고 */}
        <div className="hidden md:flex flex-col items-end gap-0 leading-[1]">
          <div className="flex items-center gap-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getWeatherIconUrl(weather.weather_icon)}
              alt={weather.weather_description}
              className="h-4 w-4"
            />
            <span className="text-[8px] text-muted-foreground whitespace-nowrap">
              {weather.weather_description}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-[9px] text-blue-500">
              {weather.temperature_min}°
            </span>
            <span className="text-[9px] text-muted-foreground">/</span>
            <span className="text-[9px] text-red-500">
              {weather.temperature_max}°
            </span>
          </div>
        </div>
      </>
    );
  }

  // 기본 — DayDetail 헤더 등에서 사용. 세로 2줄로 컴팩트하게.
  return (
    <div className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
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

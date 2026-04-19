"use client";

import { useEffect, useState } from "react";
import { Search as SearchIcon, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PlaceInfo } from "@/types";

// 인라인 장소 검색 — /api/naver/search 재사용.
// 선택 시 onPick(place) 호출하고 입력창 클리어.

interface NaverResult {
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onPick: (place: PlaceInfo) => void;
  placeholder?: string;
  className?: string;
}

export default function PlanPlacePicker({
  value,
  onChange,
  onPick,
  placeholder = "장소 검색",
  className,
}: Props) {
  const [results, setResults] = useState<NaverResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/naver/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setResults([]);
          return;
        }
        setResults(json.items ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  const handlePick = (r: NaverResult) => {
    onPick({
      name: r.name,
      address: r.roadAddress || r.address,
      lat: r.lat,
      lng: r.lng,
    });
    onChange("");
    setResults([]);
  };

  return (
    <div className={`relative ${className || ""}`}>
      <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        className="pl-8 h-8 text-xs"
      />
      {focused && value.trim() && (loading || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
          {loading ? (
            <p className="p-3 text-xs text-muted-foreground text-center">검색 중…</p>
          ) : (
            <ul className="divide-y">
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePick(r)}
                    className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.roadAddress || r.address}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

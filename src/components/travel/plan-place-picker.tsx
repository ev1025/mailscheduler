"use client";

import { useEffect, useRef, useState } from "react";
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
  autoFocus?: boolean;
  // 사용자가 결과를 선택하지 않고 포커스를 잃었을 때 (탭 외부 등).
  // 결과 버튼의 onMouseDown preventDefault 로 블러는 차단되어 있어,
  // 이 콜백은 "진짜로 포커스를 다른 곳으로 이동한 경우"에만 호출됨.
  onBlur?: () => void;
}

export default function PlanPlacePicker({
  value,
  onChange,
  onPick,
  placeholder = "장소 검색",
  className,
  autoFocus = false,
  onBlur,
}: Props) {
  const [results, setResults] = useState<NaverResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // autoFocus — mount 시 + 동적으로 true 가 되는 순간에도 포커스
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

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
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // 결과 클릭은 onMouseDown preventDefault 로 블러를 막고 있으므로
          // 여기서 호출되는 onBlur 는 "진짜 외부 클릭/탭" 이라는 의미.
          setTimeout(() => {
            setFocused(false);
            onBlur?.();
          }, 150);
        }}
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

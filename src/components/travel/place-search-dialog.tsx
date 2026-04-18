"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, MapPin } from "lucide-react";
import { toast } from "sonner";

export interface PickedPlace {
  name: string;
  address: string;   // 도로명 우선, 없으면 지번
  lat: number;
  lng: number;
}

interface NaverPlace {
  name: string;
  category: string;
  address: string;
  roadAddress: string;
  telephone: string;
  lat: number;
  lng: number;
  link: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (p: PickedPlace) => void;
  initialQuery?: string;
}

export default function PlaceSearchDialog({
  open,
  onOpenChange,
  onPick,
  initialQuery = "",
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<NaverPlace[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setResults([]);
    setError(null);
  }, [open, initialQuery]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/naver/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json.error || "검색 실패");
          return;
        }
        if (!cancelled) setResults(json.items || []);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handlePick = (p: NaverPlace) => {
    onPick({
      name: p.name,
      address: p.roadAddress || p.address,
      lat: p.lat,
      lng: p.lng,
    });
    onOpenChange(false);
    toast.success("위치가 설정되었습니다");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>위치 검색</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="장소명·주소·지역 (예: 애월 카페, 해운대)"
            className="pl-8 h-9 text-sm"
            autoFocus
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto rounded-md border">
          {loading ? (
            <p className="text-xs text-muted-foreground p-4 text-center">검색 중...</p>
          ) : error ? (
            <p className="text-xs text-destructive p-4 text-center">{error}</p>
          ) : results.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">
              {query.trim() ? "결과 없음" : "검색어를 입력하세요"}
            </p>
          ) : (
            <ul className="divide-y">
              {results.map((p, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => handlePick(p)}
                    className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5 mt-1 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.roadAddress || p.address}
                      </div>
                      {p.category && (
                        <div className="text-[10px] text-muted-foreground/70 truncate">
                          {p.category.replace(/>/g, " › ")}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground/70 text-right">
          powered by 네이버 검색
        </p>
      </DialogContent>
    </Dialog>
  );
}

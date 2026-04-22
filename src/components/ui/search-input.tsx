"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// 돋보기 + 검색 input 공통 컴포넌트.
// database-view / travel-list / plan-list / knowledge-dashboard 등
// 목록 페이지 상단 검색바를 통일.

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** 기본 h-8 text-xs. "md" 는 h-9 text-sm. */
  size?: "sm" | "md";
  autoFocus?: boolean;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "검색...",
  className,
  size = "sm",
  autoFocus,
}: Props) {
  const heightCls = size === "md" ? "h-9 text-sm" : "h-8 text-xs";
  // 아이콘 크기·위치·input padding 을 size 에 맞춰 비례 — 이전에는 size=md 에서도
  // 아이콘이 h-3.5(14px) 였고 pl-8(32px) 이라 큰 input 내 좌측 공백이 과하게 비어 보였음.
  const iconCls = size === "md" ? "left-3 h-4 w-4" : "left-2.5 h-3.5 w-3.5";
  const padCls = size === "md" ? "pl-9" : "pl-8";
  return (
    <div className={cn("relative flex-1 min-w-0", className)}>
      <Search className={cn("absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none shrink-0", iconCls)} />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(heightCls, padCls)}
        autoFocus={autoFocus}
      />
    </div>
  );
}

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
  return (
    <div className={cn("relative flex-1 min-w-0", className)}>
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(heightCls, "pl-8")}
        autoFocus={autoFocus}
      />
    </div>
  );
}

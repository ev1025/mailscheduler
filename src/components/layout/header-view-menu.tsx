"use client";

import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";

export interface HeaderViewMenuItem {
  key: string;
  label: string;
  icon: React.ElementType;
  active?: boolean;
  onSelect: () => void;
}

// PageHeader actions 슬롯에 사용하는 햄버거 드롭다운.
// 캘린더(달력/일정목록), 여행(여행/여행 계획) 등 같은 탭 그룹 안에서
// 하위 뷰를 전환할 때 공통 UX.
export default function HeaderViewMenu({ items }: { items: HeaderViewMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
        aria-label="메뉴"
      >
        <Menu className="h-[22px] w-[22px]" strokeWidth={1.6} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border bg-popover p-1 shadow-lg">
          {items.map(({ key, label, icon: Icon, active, onSelect }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelect();
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                active ? "bg-accent font-medium" : "hover:bg-accent/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

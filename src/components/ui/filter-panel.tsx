"use client";

import { useEffect, useRef } from "react";

/**
 * 칩 형태의 다중 선택 필터 패널.
 * - open=true일 때만 렌더
 * - 바깥 클릭 시 onClose 호출 (data-filter-btn이 붙은 요소 클릭은 제외 — 토글 버튼 자체)
 * - "전체" 버튼 + 각 항목 칩 (활성 시 colorOf 컬러로 하이라이트)
 *
 * DatabaseView, TravelList 등에서 공유.
 */
interface Props {
  open: boolean;
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  onClear: () => void;
  onClose: () => void;
  colorOf?: (item: string) => string;
}

export default function FilterPanel({
  open,
  items,
  selected,
  onToggle,
  onClear,
  onClose,
  colorOf,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (ref.current?.contains(t)) return;
      // 토글 버튼 자체는 제외 — 버튼 자기 로직이 닫기 처리
      if (t.closest?.("[data-filter-btn]")) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="flex flex-wrap gap-1.5 rounded-md border bg-muted/20 p-2"
    >
      <button
        type="button"
        onClick={onClear}
        className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
          selected.length === 0
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent"
        }`}
      >
        전체
      </button>
      {items.map((item) => {
        const active = selected.includes(item);
        const c = colorOf?.(item) ?? "#6B7280";
        return (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors"
            style={
              active
                ? {
                    borderColor: c,
                    backgroundColor: c + "20",
                    color: c,
                    fontWeight: 600,
                  }
                : {}
            }
          >
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: c }}
            />
            {item}
          </button>
        );
      })}
    </div>
  );
}

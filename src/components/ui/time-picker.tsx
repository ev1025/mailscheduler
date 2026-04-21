"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 3;

function WheelColumn({ items, selected, onSelect }: {
  items: string[];
  selected: string;
  onSelect: (val: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const selectedIdx = items.indexOf(selected);

  useEffect(() => {
    if (ref.current && selectedIdx >= 0) {
      ref.current.scrollTop = selectedIdx * ITEM_HEIGHT;
    }
  }, [selectedIdx]);

  const handleScroll = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(idx, items.length - 1));
      ref.current.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: "smooth" });
      onSelect(items[clamped]);
    }, 80);
  }, [items, onSelect]);

  return (
    <div
      ref={ref}
      className="relative overflow-y-auto scrollbar-none flex-1"
      style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}
      onScroll={handleScroll}
    >
      <div style={{ height: ITEM_HEIGHT }} />
      {items.map((item, i) => {
        const isSelected = item === selected;
        return (
          <div
            key={i}
            className={cn(
              "flex items-center justify-center text-sm transition-all cursor-pointer select-none",
              isSelected ? "text-foreground font-semibold scale-105" : "text-muted-foreground/50"
            )}
            style={{ height: ITEM_HEIGHT }}
            onClick={() => {
              onSelect(item);
              ref.current?.scrollTo({ top: items.indexOf(item) * ITEM_HEIGHT, behavior: "smooth" });
            }}
          >
            {item}
          </div>
        );
      })}
      <div style={{ height: ITEM_HEIGHT }} />
    </div>
  );
}

export default function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [open, setOpen] = useState(false);

  const parseValue = (v: string) => {
    if (!v) return { period: "AM", hour: "12", min: "00" };
    const [hStr, mStr] = v.split(":");
    let h = parseInt(hStr);
    const period = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return { period, hour: String(h), min: mStr || "00" };
  };

  const { period, hour, min } = parseValue(value);
  const [selPeriod, setSelPeriod] = useState(period);
  const [selHour, setSelHour] = useState(hour);
  const [selMin, setSelMin] = useState(min);

  useEffect(() => {
    if (open) {
      const now = new Date();
      const currentTime = value || `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const { period: p, hour: h, min: m } = parseValue(currentTime);
      setSelPeriod(p);
      setSelHour(h);
      setSelMin(m);
    }
  }, [open, value]);

  const buildTime = (p: string, h: string, m: string) => {
    let hr = parseInt(h);
    if (p === "AM" && hr === 12) hr = 0;
    else if (p === "PM" && hr !== 12) hr += 12;
    return `${String(hr).padStart(2, "0")}:${m}`;
  };

  const handleConfirm = () => {
    onChange(buildTime(selPeriod, selHour, selMin));
    setOpen(false);
  };

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const mins = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors hover:bg-accent cursor-pointer",
          !value && "text-muted-foreground",
          className
        )}
      >
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        {value || `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`}
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start" side="bottom">
        <div className="flex items-center relative">
          <div
            className="absolute left-2 border-t border-b pointer-events-none z-10"
            style={{ top: ITEM_HEIGHT, height: ITEM_HEIGHT, right: 48 }}
          />
          <WheelColumn items={["AM", "PM"]} selected={selPeriod} onSelect={setSelPeriod} />
          <WheelColumn items={hours} selected={selHour} onSelect={setSelHour} />
          <div className="flex items-center justify-center text-sm font-semibold text-muted-foreground" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>:</div>
          <WheelColumn items={mins} selected={selMin} onSelect={setSelMin} />
          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center justify-center px-3 text-sm font-semibold hover:text-blue-600 transition-colors"
            style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}
          >
            선택
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

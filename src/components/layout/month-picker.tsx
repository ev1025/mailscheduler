"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MonthPickerProps {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function MonthPicker({
  year,
  month,
  onYearChange,
  onMonthChange,
}: MonthPickerProps) {
  const [yearOpen, setYearOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const years = Array.from({ length: 9 }, (_, i) => year - 4 + i);

  const goPrev = () => {
    if (month === 1) { onYearChange(year - 1); onMonthChange(12); }
    else onMonthChange(month - 1);
  };

  const goNext = () => {
    if (month === 12) { onYearChange(year + 1); onMonthChange(1); }
    else onMonthChange(month + 1);
  };

  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* 년도 */}
      <Popover open={yearOpen} onOpenChange={setYearOpen}>
        <PopoverTrigger className="rounded-md px-1.5 py-1 text-lg font-bold hover:bg-accent transition-colors cursor-pointer">
          {year}년
        </PopoverTrigger>
        <PopoverContent className="w-[180px] p-2" align="center" side="bottom">
          <div className="grid grid-cols-3 gap-1">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => { onYearChange(y); setYearOpen(false); }}
                className={`h-9 rounded text-sm transition-colors ${
                  y === year
                    ? "bg-primary text-primary-foreground font-bold"
                    : y === currentYear
                      ? "text-blue-600 font-semibold hover:bg-accent"
                      : "hover:bg-accent"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 월 */}
      <Popover open={monthOpen} onOpenChange={setMonthOpen}>
        <PopoverTrigger className="rounded-md px-1.5 py-1 text-lg font-bold hover:bg-accent transition-colors cursor-pointer">
          {String(month).padStart(2, "0")}월
        </PopoverTrigger>
        <PopoverContent className="w-[180px] p-2" align="center" side="bottom">
          <div className="grid grid-cols-4 gap-1">
            {MONTHS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { onMonthChange(m); setMonthOpen(false); }}
                className={`h-9 rounded text-sm transition-colors ${
                  m === month
                    ? "bg-primary text-primary-foreground font-bold"
                    : m === currentMonth && year === currentYear
                      ? "text-blue-600 font-semibold hover:bg-accent"
                      : "hover:bg-accent"
                }`}
              >
                {m}월
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

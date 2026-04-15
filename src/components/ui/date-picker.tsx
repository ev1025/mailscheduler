"use client";

import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function DatePicker({ value, onChange, className, placeholder = "날짜 선택" }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value + "T00:00:00") : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());
  const [mode, setMode] = useState<"calendar" | "year" | "month">("calendar");
  const [isLunar, setIsLunar] = useState(false);

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (o) {
      const d = value ? new Date(value + "T00:00:00") : new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setMode("calendar");
    }
  };

  const monthStart = startOfMonth(new Date(viewYear, viewMonth));
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const goPrev = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const selectDate = (day: Date) => {
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  const goToday = () => {
    const now = new Date();
    onChange(format(now, "yyyy-MM-dd"));
    setOpen(false);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 9 }, (_, i) => viewYear - 4 + i);
  const months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger
        className={cn(
          "flex items-center justify-center gap-1 rounded-md border px-1.5 text-sm whitespace-nowrap tabular-nums transition-colors hover:bg-accent cursor-pointer",
          !value && "text-muted-foreground",
          className
        )}
      >
        {!value && <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="truncate">{value || placeholder}</span>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-2.5" align="start" side="bottom">
        {mode === "calendar" ? (
          <div className="flex flex-col gap-2">
            {/* 헤더: 년/월 각각 클릭 */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-0.5">
                <button className="text-sm font-medium hover:text-blue-600 transition-colors px-1" onClick={() => setMode("year")}>
                  {viewYear}년
                </button>
                <button className="text-sm font-medium hover:text-blue-600 transition-colors px-1" onClick={() => setMode("month")}>
                  {viewMonth + 1}월
                </button>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* 요일 */}
            <div className="grid grid-cols-7">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    "text-center text-[11px] font-medium py-1",
                    i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
                  )}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const inMonth = isSameMonth(day, monthStart);
                const today = isToday(day);
                const selected = value && isSameDay(day, new Date(value + "T00:00:00"));
                const dow = day.getDay();

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => selectDate(day)}
                    className={cn(
                      "h-8 w-8 mx-auto rounded-full text-sm transition-colors",
                      !inMonth && "text-muted-foreground/30",
                      selected
                        ? "bg-primary text-primary-foreground font-bold"
                        : today
                          ? "bg-accent font-medium"
                          : dow === 0
                            ? "text-red-500 hover:bg-accent"
                            : dow === 6
                              ? "text-blue-500 hover:bg-accent"
                              : "hover:bg-accent"
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>

            {/* 하단: 음력/양력 + 오늘 */}
            <div className="flex items-center justify-between pt-1 border-t">
              <button
                type="button"
                className="text-[11px] rounded px-1.5 py-0.5 border text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsLunar(!isLunar)}
              >
                {isLunar ? "음력" : "양력"}
              </button>
              <button
                type="button"
                className="text-[11px] text-blue-600 hover:underline"
                onClick={goToday}
              >
                오늘
              </button>
            </div>
          </div>
        ) : mode === "year" ? (
          <div className="grid grid-cols-3 gap-1">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => { setViewYear(y); setMode("month"); }}
                className={cn(
                  "h-9 rounded text-sm transition-colors",
                  y === viewYear ? "bg-primary text-primary-foreground font-bold" : y === currentYear ? "text-blue-600 font-medium hover:bg-accent" : "hover:bg-accent"
                )}
              >
                {y}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1">
            {months.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setViewMonth(m); setMode("calendar"); }}
                className={cn(
                  "h-9 rounded text-sm transition-colors",
                  m === viewMonth ? "bg-primary text-primary-foreground font-bold" : "hover:bg-accent"
                )}
              >
                {m + 1}월
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

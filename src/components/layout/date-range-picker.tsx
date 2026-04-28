"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * 시작일/종료일 범위 달력 픽커.
 *
 * 기존 MonthPicker 의 "년 + 월" 두 단계 선택을 대체. 사용자가 임의 구간으로
 * 가계부를 보고 싶을 때(예: 카드 결제 사이클 25일 ~ 다음달 24일) 직접 선택 가능.
 *
 * UX:
 * - 트리거: 'YYYY.MM.DD - YYYY.MM.DD' (한 달 정확히 일치 시 'YYYY년 M월' 으로 압축)
 * - 좌우 화살표: 동일 길이만큼 이전/다음 구간으로 이동 (한 달 단위면 한 달, 임의면 그 일수)
 * - 클릭: 1번째 날짜 → start, 2번째 → end. start 보다 이전 날짜 선택하면 자동 swap.
 * - range 배경 채움: 두 endpoint 사이 날짜에 bg-primary/15
 * - 프리셋: 이번달 / 지난달 / 최근 7일 / 최근 30일
 */

interface Props {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD (inclusive) */
  endDate: string;
  onChange: (start: string, end: string) => void;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(s: string): Date {
  return new Date(s + "T00:00:00");
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 트리거 표시 — 한 달 정확히 일치하면 'YYYY년 M월', 아니면 'YYYY.MM.DD - YYYY.MM.DD'. */
function formatRangeLabel(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  const sIsFirst = s.getDate() === 1;
  const eIsLast = isSameDay(e, endOfMonth(e));
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sIsFirst && eIsLast && sameMonth) {
    return `${s.getFullYear()}년 ${s.getMonth() + 1}월`;
  }
  const fmt = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  return `${fmt(s)} - ${fmt(e)}`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function DateRangePicker({ startDate, endDate, onChange }: Props) {
  const [open, setOpen] = useState(false);
  // 캘린더 안에서 보고 있는 달 — 시작일 기준으로 초기화.
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(parseISO(startDate)));
  // 첫 클릭 후 두 번째 클릭 대기 중인 임시 시작일.
  const [pendingStart, setPendingStart] = useState<Date | null>(null);

  const today = new Date();
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  // 좌우 화살표 — 현재 구간 길이만큼 이동.
  const goPrev = () => {
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const newStart = new Date(start);
    newStart.setDate(newStart.getDate() - days);
    const newEnd = new Date(end);
    newEnd.setDate(newEnd.getDate() - days);
    onChange(toISODate(newStart), toISODate(newEnd));
  };
  const goNext = () => {
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const newStart = new Date(start);
    newStart.setDate(newStart.getDate() + days);
    const newEnd = new Date(end);
    newEnd.setDate(newEnd.getDate() + days);
    onChange(toISODate(newStart), toISODate(newEnd));
  };

  const handlePickDate = (d: Date) => {
    if (!pendingStart) {
      // 첫 번째 클릭 — start 후보로 둠. end 는 아직 선택 안 됨.
      setPendingStart(d);
      return;
    }
    // 두 번째 클릭 — end 결정. 시간 순서 자동 정렬.
    let s = pendingStart;
    let e = d;
    if (e < s) [s, e] = [e, s];
    onChange(toISODate(s), toISODate(e));
    setPendingStart(null);
    setOpen(false);
  };

  const setPreset = (s: Date, e: Date) => {
    onChange(toISODate(s), toISODate(e));
    setPendingStart(null);
    setOpen(false);
  };

  // 캘린더 그리드 생성 — 월 첫날의 요일 만큼 빈 칸 + 마지막 날까지 + 다음 줄 끝까지 빈 칸.
  const monthFirst = startOfMonth(viewMonth);
  const monthLast = endOfMonth(viewMonth);
  const leadingBlanks = monthFirst.getDay(); // 0=일
  const totalCells = Math.ceil((leadingBlanks + monthLast.getDate()) / 7) * 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= monthLast.getDate(); d++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  }
  while (cells.length < totalCells) cells.push(null);

  const isInRange = (d: Date): boolean => {
    if (pendingStart) {
      // 1차 선택 후 hover 가 없으니 임시로 pendingStart 단독 표시만.
      return false;
    }
    return d >= start && d <= end;
  };
  const isEndpoint = (d: Date): "start" | "end" | null => {
    if (pendingStart && isSameDay(d, pendingStart)) return "start";
    if (!pendingStart && isSameDay(d, start)) return "start";
    if (!pendingStart && isSameDay(d, end)) return "end";
    return null;
  };

  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPendingStart(null); }}>
        <PopoverTrigger className="rounded-md px-2 py-1 text-base md:text-lg font-bold hover:bg-accent transition-colors cursor-pointer tabular-nums">
          {formatRangeLabel(startDate, endDate)}
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-3" align="center" side="bottom">
          {/* 캘린더 헤더: 이전 달 / 보고 있는 년월 / 다음 달 */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold tabular-nums">
              {viewMonth.getFullYear()}년 {viewMonth.getMonth() + 1}월
            </div>
            <button
              type="button"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent"
              aria-label="다음 달"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={`text-center text-[10px] font-medium ${
                  i === 0 ? "text-rose-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 — range 배경 + endpoint 강조. */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="h-8" />;
              const inRange = isInRange(d);
              const endpoint = isEndpoint(d);
              const isToday = isSameDay(d, today);
              const dow = d.getDay();
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePickDate(d)}
                  className={`h-8 text-xs tabular-nums rounded transition-colors ${
                    endpoint
                      ? "bg-primary text-primary-foreground font-bold"
                      : inRange
                        ? "bg-primary/15"
                        : "hover:bg-accent"
                  } ${
                    !endpoint && !inRange && isToday
                      ? "ring-1 ring-primary/40 font-semibold"
                      : ""
                  } ${
                    !endpoint && !inRange
                      ? dow === 0
                        ? "text-rose-500"
                        : dow === 6
                          ? "text-blue-500"
                          : ""
                      : ""
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* 프리셋 — 자주 쓰는 구간 빠른 선택. */}
          <div className="mt-3 flex flex-wrap gap-1 pt-2 border-t">
            <button
              type="button"
              onClick={() => {
                const s = new Date(today.getFullYear(), today.getMonth(), 1);
                const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                setPreset(s, e);
              }}
              className="px-2.5 py-1 text-[11px] rounded-full border hover:bg-accent transition-colors"
            >
              이번달
            </button>
            <button
              type="button"
              onClick={() => {
                const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const e = new Date(today.getFullYear(), today.getMonth(), 0);
                setPreset(s, e);
              }}
              className="px-2.5 py-1 text-[11px] rounded-full border hover:bg-accent transition-colors"
            >
              지난달
            </button>
            <button
              type="button"
              onClick={() => {
                const e = new Date(today);
                const s = new Date(today);
                s.setDate(s.getDate() - 6);
                setPreset(s, e);
              }}
              className="px-2.5 py-1 text-[11px] rounded-full border hover:bg-accent transition-colors"
            >
              최근 7일
            </button>
            <button
              type="button"
              onClick={() => {
                const e = new Date(today);
                const s = new Date(today);
                s.setDate(s.getDate() - 29);
                setPreset(s, e);
              }}
              className="px-2.5 py-1 text-[11px] rounded-full border hover:bg-accent transition-colors"
            >
              최근 30일
            </button>
          </div>

          {pendingStart && (
            <p className="mt-2 text-[11px] text-muted-foreground text-center">
              종료일을 선택하세요
            </p>
          )}
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

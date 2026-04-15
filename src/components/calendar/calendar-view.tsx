"use client";

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
  isWithinInterval,
  parseISO,
  differenceInDays,
} from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState, useMemo } from "react";
import type { CalendarEvent, WeatherData } from "@/types";
import WeatherIcon from "./weather-icon";
import { getHolidayMap } from "@/lib/holidays";

interface CalendarViewProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  weatherMap: Record<string, WeatherData>;
  onDateClick: (date: string) => void;
  onEventMove?: (eventId: string, newStartDate: string, newEndDate: string | null) => void;
  onReorder?: (ids: string[]) => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_VISIBLE_SLOTS = 3;
const BAR_HEIGHT = 14; // px
const BAR_GAP = 2; // px

// 주 내에서 특정 이벤트가 차지하는 세그먼트
interface WeekSegment {
  event: CalendarEvent;
  startCol: number; // 0-6 (일=0)
  spanDays: number; // 이 주 내에서 몇 칸
  isEventStart: boolean; // 실제 이벤트 시작 여부 (주 경계에서 잘렸으면 false)
  isEventEnd: boolean;
  slot: number; // 세로 위치
  endLabel: string; // "~M/D"
}

function DraggableSegment({
  segment,
  onClickDate,
}: {
  segment: WeekSegment;
  onClickDate: (dateStr: string) => void;
}) {
  const { event, startCol, spanDays, isEventStart, isEventEnd, slot, endLabel } = segment;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${event.id}__${event.start_date}__week${startCol}`,
    data: { event },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging) onClickDate(event.start_date);
      }}
      className={`flex items-center justify-center cursor-grab active:cursor-grabbing pointer-events-auto ${
        isDragging ? "opacity-30" : ""
      }`}
      style={{
        // CSS Grid 네이티브 배치 — 픽셀 계산 불필요, 완전 동적
        gridColumnStart: startCol + 1,
        gridColumnEnd: `span ${spanDays}`,
        gridRowStart: 1,
        // 세로 위치: slot * (바 높이 + 갭). 모든 바를 grid row 1에 포갠 뒤 margin-top으로 분리
        marginTop: slot * (BAR_HEIGHT + BAR_GAP),
        backgroundColor: event.color,
        color: "white",
        height: `${BAR_HEIGHT}px`,
        fontSize: "10px",
        lineHeight: 1,
        padding: "0 4px",
        borderTopLeftRadius: isEventStart ? 3 : 0,
        borderBottomLeftRadius: isEventStart ? 3 : 0,
        borderTopRightRadius: isEventEnd ? 3 : 0,
        borderBottomRightRadius: isEventEnd ? 3 : 0,
        whiteSpace: "nowrap",
        overflow: "hidden",
        alignSelf: "start",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
        {event.title}
        {endLabel && <span style={{ opacity: 0.85 }}> ({endLabel})</span>}
      </span>
    </div>
  );
}

function DroppableCell({
  dateStr,
  children,
  isOver,
  onClick,
}: {
  dateStr: string;
  children: React.ReactNode;
  isOver: boolean;
  onClick: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: dateStr });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`flex flex-col items-start border-b border-r last:border-r-0 py-1 px-0 min-w-0 min-h-0 text-left transition-colors cursor-pointer ${
        isOver ? "bg-blue-50 ring-1 ring-blue-300 ring-inset" : "hover:bg-accent/50"
      }`}
    >
      {children}
    </div>
  );
}

export default function CalendarView({
  year,
  month,
  events,
  weatherMap,
  onDateClick,
  onEventMove,
  onReorder,
}: CalendarViewProps) {
  const holidayMap = getHolidayMap(year);
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [overDate, setOverDate] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // 이벤트 → 슬롯 고정 매핑 (greedy interval scheduling)
  // 한 번 할당된 슬롯은 이벤트 기간 내내 유지 → 멀티데이 바의 수직 위치 안정
  const eventSlotMap = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...events].sort((a, b) => {
      if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
      const aEnd = a.end_date || a.start_date;
      const bEnd = b.end_date || b.start_date;
      return bEnd.localeCompare(aEnd); // 긴 이벤트 먼저
    });
    const slotLastEnd: string[] = [];
    for (const ev of sorted) {
      const start = ev.start_date;
      const end = ev.end_date || ev.start_date;
      let slot = 0;
      while (slot < slotLastEnd.length && slotLastEnd[slot] >= start) slot++;
      slotLastEnd[slot] = end;
      map.set(ev.id, slot);
    }
    return map;
  }, [events]);

  // 주 단위로 days를 나눔
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [days]);

  // 주별 세그먼트 계산 — 각 이벤트가 주 내 어느 칸부터 몇 칸을 차지하는지
  const weekSegments = useMemo(() => {
    return weeks.map((week) => {
      const weekStart = week[0];
      const weekEnd = week[6];
      const segments: WeekSegment[] = [];
      for (const ev of events) {
        const start = parseISO(ev.start_date);
        const end = ev.end_date ? parseISO(ev.end_date) : start;
        // 이 주와 이벤트 기간이 겹치는가?
        if (end < weekStart || start > weekEnd) continue;
        const segStart = start < weekStart ? weekStart : start;
        const segEnd = end > weekEnd ? weekEnd : end;
        const startCol = segStart.getDay();
        const spanDays = differenceInDays(segEnd, segStart) + 1;
        const isEventStart = isSameDay(segStart, start);
        const isEventEnd = isSameDay(segEnd, end);
        const single = isSameDay(start, end);
        segments.push({
          event: ev,
          startCol,
          spanDays,
          isEventStart,
          isEventEnd,
          slot: eventSlotMap.get(ev.id) ?? 0,
          endLabel: single ? "" : `~${end.getMonth() + 1}/${end.getDate()}`,
        });
      }
      return segments;
    });
  }, [weeks, events, eventSlotMap]);

  // 주별로 각 날짜의 "hidden 개수" 계산 (slot >= MAX_VISIBLE_SLOTS인 이벤트)
  const weekHiddenCounts = useMemo(() => {
    return weekSegments.map((segments) => {
      const perDay = new Array(7).fill(0) as number[];
      for (const seg of segments) {
        if (seg.slot < MAX_VISIBLE_SLOTS) continue;
        for (let i = 0; i < seg.spanDays; i++) {
          perDay[seg.startCol + i] = (perDay[seg.startCol + i] || 0) + 1;
        }
      }
      return perDay;
    });
  }, [weekSegments]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveEvent(e.active.data.current?.event || null);
  };

  const handleDragOver = (e: { over: { id: string | number } | null }) => {
    setOverDate(e.over ? String(e.over.id) : null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const draggedEvent = activeEvent;
    setActiveEvent(null);
    setOverDate(null);

    if (!e.over || !draggedEvent) return;
    const targetDateStr = String(e.over.id);

    if (targetDateStr === draggedEvent.start_date && onReorder) {
      // 같은 날 내 순서 변경 (단일 일정들 대상)
      const dayEvents = events
        .filter((ev) => {
          const s = parseISO(ev.start_date);
          const en = ev.end_date ? parseISO(ev.end_date) : s;
          return isSameDay(s, en) && isSameDay(s, parseISO(targetDateStr));
        });
      const oldIdx = dayEvents.findIndex((ev) => ev.id === draggedEvent.id);
      if (oldIdx !== -1) {
        const reordered = [...dayEvents];
        reordered.splice(oldIdx, 1);
        reordered.push(draggedEvent);
        onReorder(reordered.map((ev) => ev.id));
      }
      return;
    }

    if (targetDateStr !== draggedEvent.start_date && onEventMove) {
      let newEndDate: string | null = null;
      if (draggedEvent.end_date) {
        const duration = differenceInDays(
          parseISO(draggedEvent.end_date),
          parseISO(draggedEvent.start_date)
        );
        const newEnd = new Date(targetDateStr + "T00:00:00");
        newEnd.setDate(newEnd.getDate() + duration);
        newEndDate = format(newEnd, "yyyy-MM-dd");
      }
      onEventMove(draggedEvent.id, targetDateStr, newEndDate);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="min-w-0 w-full flex flex-col flex-1 min-h-0">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b shrink-0">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`py-2 text-center text-sm font-semibold ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 주별 행 — 각 주가 flex-1로 공간 분할, 행 내부는 cells 레이어 + 이벤트 오버레이 레이어 */}
        <div className="flex flex-col flex-1 min-h-0">
          {weeks.map((week, weekIdx) => {
            const segments = weekSegments[weekIdx];
            const hiddenPerDay = weekHiddenCounts[weekIdx];
            return (
              <div
                key={weekIdx}
                className="relative flex-1 min-h-0 grid grid-cols-7"
              >
                {/* 셀 레이어 */}
                {week.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const weather = weatherMap[dateStr];
                  const holiday = holidayMap[dateStr];
                  const inMonth = isSameMonth(day, monthStart);
                  const today = isToday(day);
                  const dayOfWeek = day.getDay();
                  const isHoliday = !!holiday || dayOfWeek === 0;
                  const isOverThis = overDate === dateStr;
                  const hidden = hiddenPerDay[dayOfWeek];

                  return (
                    <DroppableCell
                      key={dateStr}
                      dateStr={dateStr}
                      isOver={isOverThis}
                      onClick={() => onDateClick(dateStr)}
                    >
                      <div
                        className={`flex w-full items-start justify-between gap-1 pl-1 pr-2 md:pl-1.5 md:pr-2.5 min-w-0 overflow-hidden ${
                          !inMonth ? "opacity-30" : ""
                        }`}
                      >
                        <span
                          className={`inline-flex h-[18px] w-[18px] md:h-5 md:w-5 items-center justify-center rounded-full text-[11px] md:text-xs font-semibold shrink-0 ${
                            today
                              ? "bg-primary text-primary-foreground"
                              : isHoliday
                                ? "text-red-500"
                                : dayOfWeek === 6
                                  ? "text-blue-500"
                                  : ""
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                        {weather && inMonth && <WeatherIcon weather={weather} compact />}
                      </div>
                      {holiday && inMonth && (
                        <span className="text-[9px] md:text-[10px] text-red-500 leading-tight truncate w-full px-1.5 md:px-2 mt-0.5">
                          {holiday}
                        </span>
                      )}
                      {/* 숨겨진 이벤트 수 — 셀 하단 */}
                      {hidden > 0 && (
                        <span
                          className="mt-auto text-[9px] text-muted-foreground px-1"
                          style={{ marginBottom: 2 }}
                        >
                          +{hidden}
                        </span>
                      )}
                    </DroppableCell>
                  );
                })}

                {/* 이벤트 바 오버레이 — 같은 7열 그리드, 각 세그먼트가 grid-column span 사용
                    top은 date/weather row 아래로 충분히 내려 데스크톱·모바일 모두 겹침 방지 */}
                <div
                  className="pointer-events-none absolute inset-x-0 grid grid-cols-7 top-[34px] md:top-[40px]"
                  style={{ gridAutoRows: "0" }}
                >
                  {segments
                    .filter((seg) => seg.slot < MAX_VISIBLE_SLOTS)
                    .map((seg) => (
                      <DraggableSegment
                        key={seg.event.id + "-w" + weekIdx}
                        segment={seg}
                        onClickDate={onDateClick}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeEvent && (
          <div
            className="text-xs text-white px-2 py-1 rounded shadow-lg"
            style={{ backgroundColor: activeEvent.color }}
          >
            {activeEvent.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

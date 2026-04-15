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
import { useState } from "react";
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

interface EventBar {
  event: CalendarEvent;
  isStart: boolean;
  isEnd: boolean;
  isSingle: boolean;
  spanDays: number; // 이 주 안에서 이 셀 이후 며칠을 차지하는지 (start 셀에서 라벨 너비 계산)
  endLabel: string; // "~M/D" 라벨 (멀티데이 종료일)
}

// 드래그 가능한 이벤트 아이템
function DraggableEvent({ event, dateStr, isSingle, isStart, isEnd, spanDays, endLabel, onClickDate }: {
  event: CalendarEvent;
  dateStr: string;
  isSingle: boolean;
  isStart: boolean;
  isEnd: boolean;
  spanDays: number;
  endLabel: string;
  onClickDate: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${event.id}__${dateStr}`,
    data: { event },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDragging) onClickDate();
  };

  if (isSingle) {
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={handleClick}
        className={`flex items-center gap-1 text-[11px] leading-[14px] truncate cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
        <span className="truncate">{event.title}</span>
      </div>
    );
  }

  // 멀티데이: 각 셀에 바(컬러 배경)를 렌더. 주의 시작 셀에서만 absolute 라벨을
  // spanDays 만큼 넓혀 중앙정렬하여 바 정중앙에 제목 표시.
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`relative cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
      style={{
        backgroundColor: event.color,
        borderTopLeftRadius: isStart ? "3px" : 0,
        borderBottomLeftRadius: isStart ? "3px" : 0,
        borderTopRightRadius: isEnd ? "3px" : 0,
        borderBottomRightRadius: isEnd ? "3px" : 0,
        marginLeft: isStart ? 0 : "-2px",
        marginRight: isEnd ? 0 : "-2px",
        height: "14px",
      }}
    >
      {isStart && (
        <div
          className="absolute top-0 left-0 flex items-center justify-center h-[14px] text-[10px] leading-none text-white whitespace-nowrap overflow-hidden px-1 pointer-events-none"
          style={{ width: `calc(${spanDays} * 100% + ${(spanDays - 1) * 2}px)` }}
        >
          <span className="truncate">
            {event.title}
            {endLabel && <span className="opacity-80"> ({endLabel})</span>}
          </span>
        </div>
      )}
    </div>
  );
}

// 드롭 가능한 날짜 셀 — 여백 넉넉히
function DroppableCell({ dateStr, children, isOver, onClick }: {
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
      className={`flex flex-col items-start border-b border-r py-1 px-0 min-w-0 min-h-0 text-left transition-colors cursor-pointer relative ${
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

  // 드래그 감도 설정 (5px 이상 움직여야 드래그 시작)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function getBarsForDate(day: Date): EventBar[] {
    const bars: EventBar[] = [];
    const weekEnd = endOfWeek(day, { weekStartsOn: 0 });
    for (const ev of events) {
      const start = parseISO(ev.start_date);
      const end = ev.end_date ? parseISO(ev.end_date) : start;
      const single = isSameDay(start, end);
      const endLabel = `~${end.getMonth() + 1}/${end.getDate()}`;

      if (single) {
        if (isSameDay(day, start)) {
          bars.push({ event: ev, isStart: true, isEnd: true, isSingle: true, spanDays: 1, endLabel: "" });
        }
      } else if (
        isWithinInterval(day, { start, end }) ||
        isSameDay(day, start) ||
        isSameDay(day, end)
      ) {
        const isStart = isSameDay(day, start) || day.getDay() === 0;
        const isEnd = isSameDay(day, end) || day.getDay() === 6;
        // 이 주에서 현재 셀부터 이벤트 끝 또는 주 끝까지 몇 일 남았는지 (start 셀 기준 spanDays)
        const lastDayInWeek = end < weekEnd ? end : weekEnd;
        const spanDays = isStart ? differenceInDays(lastDayInWeek, day) + 1 : 1;
        bars.push({
          event: ev,
          isStart,
          isEnd,
          isSingle: false,
          spanDays,
          endLabel,
        });
      }
    }
    return bars;
  }

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

    // 같은 날짜 → 순서 변경
    if (targetDateStr === draggedEvent.start_date && onReorder) {
      const dateBars = getBarsForDate(parseISO(draggedEvent.start_date));
      const singleEvents = dateBars.filter((b) => b.isSingle || b.isStart).map((b) => b.event);
      // 드래그된 이벤트를 드롭 위치로 이동
      const oldIdx = singleEvents.findIndex((ev) => ev.id === draggedEvent.id);
      if (oldIdx !== -1) {
        const reordered = [...singleEvents];
        reordered.splice(oldIdx, 1);
        // 드롭 위치: 가장 가까운 이벤트 아래
        reordered.push(draggedEvent); // 맨 뒤에 추가 (간단 구현)
        onReorder(reordered.map((ev) => ev.id));
      }
      return;
    }

    // 다른 날짜 → 이동
    if (targetDateStr !== draggedEvent.start_date && onEventMove) {
      let newEndDate: string | null = null;
      if (draggedEvent.end_date) {
        const duration = differenceInDays(parseISO(draggedEvent.end_date), parseISO(draggedEvent.start_date));
        const newEnd = new Date(targetDateStr + "T00:00:00");
        newEnd.setDate(newEnd.getDate() + duration);
        newEndDate = format(newEnd, "yyyy-MM-dd");
      }
      onEventMove(draggedEvent.id, targetDateStr, newEndDate);
    }
  };

  const rowCount = Math.ceil(days.length / 7);

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

        {/* 날짜 그리드 — 뷰포트 남은 공간에 맞춰 flex-1, 행 수에 따라 자동 분할 */}
        <div
          className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0 flex-1 min-h-0"
          style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
        >
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const bars = getBarsForDate(day);
            const weather = weatherMap[dateStr];
            const holiday = holidayMap[dateStr];
            const inMonth = isSameMonth(day, monthStart);
            const today = isToday(day);
            const dayOfWeek = day.getDay();
            const isHoliday = !!holiday || dayOfWeek === 0;
            const isOverThis = overDate === dateStr;

            return (
              <DroppableCell key={dateStr} dateStr={dateStr} isOver={isOverThis} onClick={() => onDateClick(dateStr)}>
                {/* 날짜 숫자 + 날씨 */}
                <div className={`flex w-full items-start justify-between gap-1 pl-1 pr-2 md:pl-1.5 md:pr-2.5 min-w-0 overflow-hidden ${!inMonth ? "opacity-30" : ""}`}>
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
                  {weather && inMonth && (
                    <WeatherIcon weather={weather} compact />
                  )}
                </div>

                {/* 공휴일 이름 */}
                {holiday && inMonth && (
                  <span className="text-[9px] md:text-[10px] text-red-500 leading-tight truncate w-full px-1.5 md:px-2 mt-0.5">
                    {holiday}
                  </span>
                )}

                {/* 이벤트 바 (드래그 가능) — 수평은 자유롭게, 수직은 maxHeight로 제한 */}
                <div className="mt-0.5 flex flex-col gap-[2px] w-full min-w-0" style={{ maxHeight: 58 }}>
                  {bars.slice(0, 3).map((bar) => (
                    <DraggableEvent
                      key={bar.event.id + dateStr}
                      event={bar.event}
                      dateStr={dateStr}
                      isSingle={bar.isSingle}
                      isStart={bar.isStart}
                      isEnd={bar.isEnd}
                      spanDays={bar.spanDays}
                      endLabel={bar.endLabel}
                      onClickDate={() => onDateClick(dateStr)}
                    />
                  ))}
                  {bars.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{bars.length - 3}개 더
                    </span>
                  )}
                </div>
              </DroppableCell>
            );
          })}
        </div>
      </div>

      {/* 드래그 중 표시 */}
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

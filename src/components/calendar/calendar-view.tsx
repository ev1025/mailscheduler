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
  isLabel: boolean; // 이 셀에 제목 라벨을 표시할지 (span의 가운데 셀)
}

// 드래그 가능한 이벤트 아이템
function DraggableEvent({ event, dateStr, isSingle, isStart, isEnd, isLabel, onClickDate }: {
  event: CalendarEvent;
  dateStr: string;
  isSingle: boolean;
  isStart: boolean;
  isEnd: boolean;
  isLabel: boolean;
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
        className={`flex items-center gap-1 text-xs leading-tight truncate cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
        <span className="truncate">{event.title}</span>
      </div>
    );
  }

  // 멀티데이: 같은 주(행) 안에서는 배경이 끊기지 않고 이어지도록 bleed.
  // 타이틀은 이 주의 가운데 셀(isLabel)에만 표시 — "제목 (~종료일)" 포맷.
  const endDate = event.end_date ? parseISO(event.end_date) : parseISO(event.start_date);
  const endLabel = `~${endDate.getMonth() + 1}/${endDate.getDate()}`;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`text-[10px] leading-tight text-white px-1 py-[1px] cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
      style={{
        backgroundColor: event.color,
        borderTopLeftRadius: isStart ? "3px" : 0,
        borderBottomLeftRadius: isStart ? "3px" : 0,
        borderTopRightRadius: isEnd ? "3px" : 0,
        borderBottomRightRadius: isEnd ? "3px" : 0,
        // 셀 경계에서 -2px씩 bleed해서 border-r 위로 덮음 → 완전 연속
        marginLeft: isStart ? 0 : "-2px",
        marginRight: isEnd ? 0 : "-2px",
        minHeight: "14px",
        position: "relative",
      }}
    >
      {isLabel ? (
        /* 가운데 셀에서 라벨을 표시. 양옆으로 넘쳐 보여도 됨 (셀 overflow-visible). */
        <span
          className="whitespace-nowrap block text-center"
          style={{ maxWidth: "none", overflow: "visible" }}
        >
          {event.title} <span className="opacity-80">({endLabel})</span>
        </span>
      ) : (
        <span>&nbsp;</span>
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
      className={`flex flex-col items-start border-b border-r py-2 md:py-2.5 px-0 min-h-[100px] md:min-h-[128px] min-w-0 text-left transition-colors cursor-pointer relative ${
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
    const weekStart = startOfWeek(day, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(day, { weekStartsOn: 0 });
    for (const ev of events) {
      const start = parseISO(ev.start_date);
      const end = ev.end_date ? parseISO(ev.end_date) : start;
      const single = isSameDay(start, end);

      if (single) {
        if (isSameDay(day, start)) {
          bars.push({ event: ev, isStart: true, isEnd: true, isSingle: true, isLabel: true });
        }
      } else {
        if (
          isWithinInterval(day, { start, end }) ||
          isSameDay(day, start) ||
          isSameDay(day, end)
        ) {
          // 이 주의 span 내에서 가운데 날짜 계산
          const spanStart = start > weekStart ? start : weekStart;
          const spanEnd = end < weekEnd ? end : weekEnd;
          const spanDays = differenceInDays(spanEnd, spanStart) + 1;
          const middleIdx = Math.floor((spanDays - 1) / 2);
          const middleDate = new Date(spanStart);
          middleDate.setDate(spanStart.getDate() + middleIdx);
          const isLabel = isSameDay(day, middleDate);
          bars.push({
            event: ev,
            isStart: isSameDay(day, start) || day.getDay() === 0,
            isEnd: isSameDay(day, end) || day.getDay() === 6,
            isSingle: false,
            isLabel,
          });
        }
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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="min-w-0 w-full">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`py-2.5 text-center text-sm font-semibold ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 — 7n번째 셀은 border-r 제거해 좌우 두께 균형 */}
        <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
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
                {/* 날짜 숫자 + 날씨 — 셀 내부 overflow-hidden으로 넘침 방지 */}
                <div className={`flex w-full items-start justify-between gap-0.5 px-1 md:px-1.5 min-w-0 overflow-hidden ${!inMonth ? "opacity-30" : ""}`}>
                  <span
                    className={`inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full text-xs md:text-sm font-semibold shrink-0 ${
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

                {/* 이벤트 바 (드래그 가능) — 수평 bleed 허용, 수직만 클립 */}
                <div className="mt-0.5 flex flex-col gap-[2px] w-full" style={{ maxHeight: 58 }}>
                  {bars.slice(0, 3).map((bar) => (
                    <DraggableEvent
                      key={bar.event.id + dateStr}
                      event={bar.event}
                      dateStr={dateStr}
                      isSingle={bar.isSingle}
                      isStart={bar.isStart}
                      isEnd={bar.isEnd}
                      isLabel={bar.isLabel}
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

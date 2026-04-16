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

/* ---------- 레이아웃 상수 (매직넘버 외부화) ---------- */
const MAX_VISIBLE_SLOTS = 4; // 셀당 최대 보여주는 이벤트 수
const BAR_HEIGHT_PX = 11; // 이벤트 바 높이
const BAR_GAP_PX = 1; // 바 사이 간격
const CELL_BLEED_PX = 1; // 셀 경계(border-r) 위로 덮어 연결하는 음수 마진
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface CalendarViewProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  weatherMap: Record<string, WeatherData>;
  onDateClick: (date: string) => void;
  onEventMove?: (eventId: string, newStartDate: string, newEndDate: string | null) => void;
  onReorder?: (ids: string[]) => void;
}

/* ---------- 타입 ---------- */

/** 주 내 한 이벤트의 세그먼트 (시각적 바 하나) */
interface WeekSegment {
  event: CalendarEvent;
  startCol: number; // 0..6
  spanDays: number; // 주 내에서 차지하는 칸 수
  isEventStart: boolean; // 실제 이벤트 시작일에 이 세그먼트가 걸리는지
  isEventEnd: boolean;
  slot: number; // 세로 슬롯 (0..MAX_VISIBLE_SLOTS-1 안쪽만 렌더)
  endLabel: string; // "~M/D" 표시 (멀티데이 끝 라벨)
}

/** 셀 하나가 가진 렌더용 데이터 */
interface DayCellData {
  day: Date;
  dateStr: string;
  slots: (DaySegmentPart | null)[]; // length === MAX_VISIBLE_SLOTS
  hiddenCount: number; // slot >= MAX_VISIBLE_SLOTS 로 잘린 이벤트 수
}

/** 한 셀 안에서 본 세그먼트의 일부 (이 셀 기준의 시작/끝/라벨 표시 여부) */
interface DaySegmentPart {
  event: CalendarEvent;
  /** 이 셀이 세그먼트의 왼쪽 끝인가 (실제 시작 or 주 시작) */
  isLeftEdge: boolean;
  /** 이 셀이 세그먼트의 오른쪽 끝인가 (실제 종료 or 주 끝) */
  isRightEdge: boolean;
  /** 실제 이벤트의 시작일에 해당하는 셀인가 (제목 표시 기준) */
  isEventStart: boolean;
  /** 실제 이벤트의 종료일에 해당하는 셀인가 */
  isEventEnd: boolean;
  /** 이 주 내에서의 spanDays (제목 라벨 ellipsis 계산용, 참고만) */
  spanDaysInWeek: number;
  endLabel: string;
}

/* ---------- 드래그 가능한 이벤트 바 세그먼트 ---------- */
function EventBarSegment({
  part,
  dateStr,
  onClickDate,
}: {
  part: DaySegmentPart;
  dateStr: string;
  onClickDate: () => void;
}) {
  const { event, isLeftEdge, isRightEdge, isEventStart, spanDaysInWeek, endLabel } = part;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${event.id}__${dateStr}`,
    data: { event },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging) onClickDate();
      }}
      className={`relative flex items-center text-white cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      }`}
      style={{
        backgroundColor: event.color,
        height: `${BAR_HEIGHT_PX}px`,
        borderTopLeftRadius: isLeftEdge ? 3 : 0,
        borderBottomLeftRadius: isLeftEdge ? 3 : 0,
        borderTopRightRadius: isRightEdge ? 3 : 0,
        borderBottomRightRadius: isRightEdge ? 3 : 0,
        marginLeft: isLeftEdge ? 0 : -CELL_BLEED_PX,
        marginRight: isRightEdge ? 0 : -CELL_BLEED_PX,
      }}
    >
      {/* 제목은 실제 이벤트 시작 셀 혹은 주 경계의 첫 셀에만 표시 (ellipsis) */}
      {isEventStart || (isLeftEdge && !isEventStart) ? (
        <span
          className="truncate px-1 font-medium"
          style={{
            fontSize: "10px",
            lineHeight: `${BAR_HEIGHT_PX}px`,
            // 이 주 내 전체 span만큼의 폭으로 보이도록 오른쪽으로 확장
            // (옆 셀의 bleed에 걸리므로 자연스럽게 이어져 보임)
            width: spanDaysInWeek > 1 ? `calc(${spanDaysInWeek} * 100%)` : "100%",
          }}
        >
          {event.title}
          {endLabel && (
            <span className="opacity-80" style={{ marginLeft: 2 }}>
              ({endLabel})
            </span>
          )}
        </span>
      ) : (
        <span>&nbsp;</span>
      )}
    </div>
  );
}

/* ---------- 드롭 가능 셀 ---------- */
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
      className={`flex min-h-0 min-w-0 cursor-pointer flex-col border-b border-r text-left transition-colors ${
        isOver ? "bg-blue-50 ring-1 ring-blue-300 ring-inset" : "hover:bg-accent/50"
      }`}
    >
      {children}
    </div>
  );
}

/* ---------- 메인 ---------- */
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

  /* 주 단위로 분할 */
  const weeks = useMemo(() => {
    const res: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) res.push(days.slice(i, i + 7));
    return res;
  }, [days]);

  /**
   * 각 주별로 greedy interval packing으로 슬롯 배치.
   * - 이어지는 세그먼트(startCol=0 && !isEventStart)를 먼저 배치해 연속성 유지
   * - 같은 col에서는 긴 세그먼트 우선
   * - 슬롯은 주 단위로 독립적 → 빈 위쪽 슬롯이 남지 않도록 재패킹됨
   */
  const weekSegments = useMemo<WeekSegment[][]>(() => {
    return weeks.map((week) => {
      const weekStart = week[0];
      const weekEnd = week[6];

      type Draft = Omit<WeekSegment, "slot">;
      const drafts: Draft[] = [];

      for (const ev of events) {
        const start = parseISO(ev.start_date);
        const end = ev.end_date ? parseISO(ev.end_date) : start;
        if (end < weekStart || start > weekEnd) continue;

        const segStart = start < weekStart ? weekStart : start;
        const segEnd = end > weekEnd ? weekEnd : end;
        const startCol = segStart.getDay();
        const spanDays = differenceInDays(segEnd, segStart) + 1;
        const single = isSameDay(start, end);

        drafts.push({
          event: ev,
          startCol,
          spanDays,
          isEventStart: isSameDay(segStart, start),
          isEventEnd: isSameDay(segEnd, end),
          endLabel: single ? "" : `~${end.getMonth() + 1}/${end.getDate()}`,
        });
      }

      drafts.sort((a, b) => {
        const aCont = !a.isEventStart && a.startCol === 0 ? 0 : 1;
        const bCont = !b.isEventStart && b.startCol === 0 ? 0 : 1;
        if (aCont !== bCont) return aCont - bCont;
        if (a.startCol !== b.startCol) return a.startCol - b.startCol;
        return b.spanDays - a.spanDays;
      });

      // 슬롯별로 사용 중인 열 범위를 기록
      const slotRanges: Array<Array<[number, number]>> = [];
      const segments: WeekSegment[] = [];
      for (const d of drafts) {
        const endCol = d.startCol + d.spanDays - 1;
        let slot = 0;
        while (slot < slotRanges.length) {
          const overlaps = slotRanges[slot].some(
            ([s, e]) => !(d.startCol > e || endCol < s)
          );
          if (!overlaps) break;
          slot++;
        }
        if (slot >= slotRanges.length) slotRanges.push([]);
        slotRanges[slot].push([d.startCol, endCol]);
        segments.push({ ...d, slot });
      }
      return segments;
    });
  }, [weeks, events]);

  /**
   * 셀 단위 렌더 데이터.
   * 각 셀은 고정 길이 MAX_VISIBLE_SLOTS 슬롯 배열을 가짐.
   * 슬롯에 해당 이벤트가 있으면 DaySegmentPart, 없으면 null (빈 spacer 렌더).
   * 잘린 이벤트 수는 hiddenCount.
   */
  const weekCellsData = useMemo<DayCellData[][]>(() => {
    return weeks.map((week, weekIdx) => {
      const segments = weekSegments[weekIdx];
      return week.map((day) => {
        const col = day.getDay();
        const dateStr = format(day, "yyyy-MM-dd");
        // 공휴일이 있는 셀은 한 줄을 공휴일 이름에 내주므로 슬롯 하나 덜 표시
        const hasHoliday = !!holidayMap[dateStr] && isSameMonth(day, monthStart);
        const visibleCount = hasHoliday ? MAX_VISIBLE_SLOTS - 1 : MAX_VISIBLE_SLOTS;
        const slots: (DaySegmentPart | null)[] = new Array(visibleCount).fill(null);
        let hiddenCount = 0;

        for (const seg of segments) {
          const endCol = seg.startCol + seg.spanDays - 1;
          if (col < seg.startCol || col > endCol) continue;
          if (seg.slot >= visibleCount) {
            hiddenCount++;
            continue;
          }
          const isLeftEdge = col === seg.startCol;
          const isRightEdge = col === endCol;
          const start = parseISO(seg.event.start_date);
          const end = seg.event.end_date ? parseISO(seg.event.end_date) : start;
          slots[seg.slot] = {
            event: seg.event,
            isLeftEdge,
            isRightEdge,
            isEventStart: isSameDay(day, start),
            isEventEnd: isSameDay(day, end),
            spanDaysInWeek: seg.spanDays,
            endLabel: seg.endLabel,
          };
        }

        return {
          day,
          dateStr,
          slots,
          hiddenCount,
        };
      });
    });
  }, [weeks, weekSegments, holidayMap, monthStart]);

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
      // 같은 날 내 순서 변경 (단일 일정들만)
      const dayEvents = events.filter((ev) => {
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
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        {/* 요일 헤더 */}
        <div className="grid shrink-0 grid-cols-7 border-b">
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

        {/* 주 단위로 1fr 분할 */}
        <div className="flex min-h-0 flex-1 flex-col">
          {weeks.map((week, weekIdx) => {
            const cells = weekCellsData[weekIdx];
            return (
              <div
                key={weekIdx}
                className="grid min-h-0 flex-1 grid-cols-7 [&>*:nth-child(7)]:border-r-0"
              >
                {week.map((day, dayIdx) => {
                  const cellData = cells[dayIdx];
                  const weather = weatherMap[cellData.dateStr];
                  const holiday = holidayMap[cellData.dateStr];
                  const inMonth = isSameMonth(day, monthStart);
                  const today = isToday(day);
                  const dow = day.getDay();
                  const isHoliday = !!holiday || dow === 0;
                  const isOverThis = overDate === cellData.dateStr;

                  return (
                    <DroppableCell
                      key={cellData.dateStr}
                      dateStr={cellData.dateStr}
                      isOver={isOverThis}
                      onClick={() => onDateClick(cellData.dateStr)}
                    >
                      {/* 헤더: 날짜 + 날씨 — flex-none, 자체 layout */}
                      <div
                        className={`flex shrink-0 items-start justify-between gap-1 overflow-hidden pl-1 pr-[13px] pt-1 md:pl-1.5 md:pr-2 ${
                          !inMonth ? "opacity-30" : ""
                        }`}
                      >
                        <span
                          className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold md:h-5 md:w-5 md:text-xs ${
                            today
                              ? "bg-primary text-primary-foreground"
                              : isHoliday
                                ? "text-red-500"
                                : dow === 6
                                  ? "text-blue-500"
                                  : ""
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                        {weather && inMonth && <WeatherIcon weather={weather} compact />}
                      </div>

                      {/* 공휴일 — truncate로 긴 이름 안전 처리 */}
                      {holiday && inMonth && (
                        <span className="mt-0.5 block w-full shrink-0 truncate px-1 text-[9px] leading-tight text-red-500 md:px-1.5 md:text-[10px]">
                          {holiday}
                        </span>
                      )}

                      {/* 이벤트 슬롯 — flex-col로 고정 높이 슬롯 3개, overflow:hidden으로 넘침 방지 */}
                      <div
                        className="mt-0.5 flex min-h-0 flex-col overflow-hidden"
                        style={{ gap: `${BAR_GAP_PX}px` }}
                      >
                        {cellData.slots.map((slot, i) => {
                          if (!slot) {
                            // 빈 슬롯 — 같은 높이 spacer로 아래 슬롯 위치 고정
                            return (
                              <div
                                key={`empty-${i}`}
                                style={{ height: BAR_HEIGHT_PX }}
                                aria-hidden
                              />
                            );
                          }
                          return (
                            <EventBarSegment
                              key={slot.event.id + "-" + i}
                              part={slot}
                              dateStr={cellData.dateStr}
                              onClickDate={() => onDateClick(cellData.dateStr)}
                            />
                          );
                        })}
                      </div>

                      {/* +N 더보기 — 셀 하단, mt-auto로 밀어냄 */}
                      {cellData.hiddenCount > 0 && (
                        <span className="mt-auto shrink-0 px-1 pb-0.5 text-[9px] text-muted-foreground md:px-1.5 md:text-[10px]">
                          +{cellData.hiddenCount}
                        </span>
                      )}
                    </DroppableCell>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeEvent && (
          <div
            className="rounded px-2 py-1 text-xs text-white shadow-lg"
            style={{ backgroundColor: activeEvent.color }}
          >
            {activeEvent.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

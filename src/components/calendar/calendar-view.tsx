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
import { useState, useMemo, useRef, useEffect } from "react";
import type { CalendarEvent, WeatherData } from "@/types";
import WeatherIcon from "./weather-icon";
import { useHolidayMap } from "@/lib/holidays";

/* ── 레이아웃 상수 ── */
const MAX_VISIBLE_SLOTS = 3;
const BAR_H = 12;
const BAR_GAP = 1;
const BAR_STEP = BAR_H + BAR_GAP;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface CalendarViewProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  weatherMap: Record<string, WeatherData>;
  onDateClick: (date: string) => void;
  onEventMove?: (eventId: string, newStart: string, newEnd: string | null) => void;
  onReorder?: (ids: string[]) => void;
}

/* ── 주 내 세그먼트 ── */
interface Seg {
  event: CalendarEvent;
  startCol: number;
  spanDays: number;
  isEventStart: boolean;
  isEventEnd: boolean;
  slot: number;
  endLabel: string;
}

/* ── 드래그 바 ── */
function DraggableBar({ seg, onClickDate }: { seg: Seg; onClickDate: (d: string) => void }) {
  const { event, startCol, spanDays, isEventStart, isEventEnd, slot, endLabel } = seg;
  const isHoliday = event.id.startsWith("__holiday__");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${event.id}__bar`,
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
      className={`pointer-events-auto flex items-center justify-center overflow-hidden text-white cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      }`}
      style={{
        // CSS Grid 이 알아서 너비 계산 — 매직넘버 없음
        gridColumn: `${startCol + 1} / span ${spanDays}`,
        gridRow: 1,
        alignSelf: "start",
        marginTop: slot * BAR_STEP,
        height: BAR_H,
        backgroundColor: event.color,
        borderTopLeftRadius: isEventStart ? 3 : 0,
        borderBottomLeftRadius: isEventStart ? 3 : 0,
        borderTopRightRadius: isEventEnd ? 3 : 0,
        borderBottomRightRadius: isEventEnd ? 3 : 0,
        fontSize: isHoliday ? 7 : 10,
        lineHeight: `${BAR_H}px`,
        whiteSpace: "nowrap",
      }}
    >
      <span className="truncate px-1">
        {event.title}
        {endLabel && <span className="ml-0.5 opacity-80">({endLabel})</span>}
      </span>
    </div>
  );
}

/* ── 드롭 셀 ── */
function DropCell({
  dateStr,
  isOver,
  onClick,
  children,
}: {
  dateStr: string;
  isOver: boolean;
  onClick: () => void;
  children: React.ReactNode;
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

/* ── 메인 ── */
export default function CalendarView({
  year,
  month,
  events,
  weatherMap,
  onDateClick,
  onEventMove,
  onReorder,
}: CalendarViewProps) {
  const holidayMap = useHolidayMap(year);

  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // 공휴일을 가상 이벤트로 변환해 달력에 빨간 바로 표시.
  // 스와이프로 월 전환 시 events 상태는 이전 월 데이터를 잠시 보유 — 새 월 grid 의
  // trailing day 셀(예: 5월 그리드의 4/30)에 이전 월 일정이 깜빡이는 걸 막기 위해
  // 표시 월(monthStart~monthEnd) 범위 안 일정만 통과시킴.
  const allEvents = useMemo(() => {
    const holidayEvents: CalendarEvent[] = Object.entries(holidayMap).map(([date, name]) => ({
      id: `__holiday__${date}`,
      title: name,
      description: null,
      start_date: date,
      end_date: null,
      start_time: null,
      end_time: null,
      color: "#EF4444",
      tag: null,
      repeat: null,
      series_id: null,
      sort_order: -1,
      created_at: "",
      user_id: "",
    }));
    const monthEvents = events.filter((ev) => {
      const s = parseISO(ev.start_date);
      const e = ev.end_date ? parseISO(ev.end_date) : s;
      return e >= monthStart && s <= monthEnd;
    });
    return [...holidayEvents, ...monthEvents];
    // monthStart/monthEnd 는 매 렌더 새 Date 라 deps 로 못 씀 — year/month primitive 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, holidayMap, year, month]);

  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [overDate, setOverDate] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // 셀 높이 기반 동적 슬롯 수 — ResizeObserver로 주 행 높이 추적
  const rowRef = useRef<HTMLDivElement>(null);
  const [dynamicMax, setDynamicMax] = useState(MAX_VISIBLE_SLOTS);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const calc = () => {
      const h = el.getBoundingClientRect().height;
      // 사용 가능 높이 = 행 높이 - 헤더 영역(~36px) - +N 표시(~14px)
      const available = h - 30 - 10;
      const fits = Math.max(0, Math.min(MAX_VISIBLE_SLOTS, Math.floor(available / BAR_STEP)));
      setDynamicMax(fits);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const weeks = useMemo(() => {
    const r: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) r.push(days.slice(i, i + 7));
    return r;
  }, [days]);

  /* 주별 greedy 슬롯 배치 */
  const weekSegs = useMemo<Seg[][]>(() => {
    return weeks.map((week) => {
      const ws = week[0], we = week[6];
      type D = Omit<Seg, "slot">;
      const drafts: D[] = [];
      for (const ev of allEvents) {
        const s = parseISO(ev.start_date);
        const e = ev.end_date ? parseISO(ev.end_date) : s;
        if (e < ws || s > we) continue;
        const ss = s < ws ? ws : s;
        const se = e > we ? we : e;
        drafts.push({
          event: ev,
          startCol: ss.getDay(),
          spanDays: differenceInDays(se, ss) + 1,
          isEventStart: isSameDay(ss, s),
          isEventEnd: isSameDay(se, e),
          endLabel: isSameDay(s, e) ? "" : `~${e.getMonth() + 1}/${e.getDate()}`,
        });
      }
      drafts.sort((a, b) => {
        const ac = !a.isEventStart && a.startCol === 0 ? 0 : 1;
        const bc = !b.isEventStart && b.startCol === 0 ? 0 : 1;
        if (ac !== bc) return ac - bc;
        if (a.startCol !== b.startCol) return a.startCol - b.startCol;
        return b.spanDays - a.spanDays;
      });
      const ranges: [number, number][][] = [];
      const segs: Seg[] = [];
      for (const d of drafts) {
        const ec = d.startCol + d.spanDays - 1;
        let sl = 0;
        while (sl < ranges.length && ranges[sl].some(([a, b]) => !(d.startCol > b || ec < a))) sl++;
        if (sl >= ranges.length) ranges.push([]);
        ranges[sl].push([d.startCol, ec]);
        segs.push({ ...d, slot: sl });
      }
      return segs;
    });
  }, [weeks, allEvents]);

  /* 셀당 숨겨진 이벤트 수 — dynamicMax 기준 */
  const weekHidden = useMemo(() => {
    return weekSegs.map((segs) => {
      const per = new Array(7).fill(0) as number[];
      for (const s of segs) {
        if (s.slot < dynamicMax) continue;
        for (let c = s.startCol; c < s.startCol + s.spanDays && c < 7; c++) per[c]++;
      }
      return per;
    });
  }, [weekSegs, dynamicMax]);

  const handleDragStart = (e: DragStartEvent) => setActiveEvent(e.active.data.current?.event || null);
  const handleDragOver = (e: { over: { id: string | number } | null }) => setOverDate(e.over ? String(e.over.id) : null);
  const handleDragEnd = (e: DragEndEvent) => {
    const ev = activeEvent;
    setActiveEvent(null);
    setOverDate(null);
    if (!e.over || !ev) return;
    const t = String(e.over.id);
    if (t !== ev.start_date && onEventMove) {
      let ne: string | null = null;
      if (ev.end_date) {
        const dur = differenceInDays(parseISO(ev.end_date), parseISO(ev.start_date));
        const nd = new Date(t + "T00:00:00");
        nd.setDate(nd.getDate() + dur);
        ne = format(nd, "yyyy-MM-dd");
      }
      onEventMove(ev.id, t, ne);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        {/* 요일 헤더 */}
        <div className="grid shrink-0 grid-cols-7 border-b">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`py-2 text-center text-sm font-semibold ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"}`}>
              {d}
            </div>
          ))}
        </div>

        {/* 주 행 */}
        <div className="flex min-h-0 flex-1 flex-col">
          {weeks.map((week, wi) => {
            const segs = weekSegs[wi];
            const hidden = weekHidden[wi];
            return (
              <div key={wi} ref={wi === 0 ? rowRef : undefined} className="relative grid min-h-0 flex-1 grid-cols-7 overflow-hidden [&>*:nth-child(7)]:border-r-0">
                {/* ── 셀 레이어: 날짜·날씨·공휴일·+N ── */}
                {week.map((day, di) => {
                  const ds = format(day, "yyyy-MM-dd");
                  const w = weatherMap[ds];
                  const h = holidayMap[ds];
                  const inM = isSameMonth(day, monthStart);
                  const tod = isToday(day);
                  const dow = day.getDay();
                  const hol = !!h || dow === 0;
                  const ov = overDate === ds;
                  const hc = hidden[di];

                  return (
                    <DropCell key={ds} dateStr={ds} isOver={ov} onClick={() => onDateClick(ds)}>
                      {/* 날짜 + 날씨 */}
                      <div className={`flex shrink-0 items-start justify-between gap-1 overflow-hidden pl-1 pr-[26px] pt-1 md:pl-1.5 md:pr-2 ${!inM ? "opacity-30" : ""}`}>
                        <span
                          // 서버(UTC)와 클라이언트(KST) 의 "오늘" 판정이 달라
                          // className 이 mismatch 날 수 있어 경고 억제.
                          // 최초 렌더 후엔 클라이언트 값으로 재조정되므로 UX 영향 없음.
                          suppressHydrationWarning
                          className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-xs font-semibold md:h-5 md:w-5 md:text-xs ${
                            tod ? "bg-primary text-primary-foreground" : hol ? "text-red-500" : dow === 6 ? "text-blue-500" : ""
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                        {w && inM && <WeatherIcon weather={w} compact />}
                      </div>
                      {/* +N — 바 오버레이 위에 표시되도록 z-index */}
                      {hc > 0 && <span className="relative z-10 mt-auto mb-[2px] shrink-0 px-1 text-[10px] text-muted-foreground">+{hc}</span>}
                    </DropCell>
                  );
                })}

                {/* ── 바 오버레이: grid-column span으로 너비, 텍스트 중앙정렬 ── */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-7 top-[28px] md:top-[32px]"
                  style={{ gridAutoRows: 0 }}
                >
                  {segs
                    .filter((s) => s.slot < dynamicMax)
                    .map((seg) => (
                      <DraggableBar key={seg.event.id + "-" + wi} seg={seg} onClickDate={onDateClick} />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeEvent && (
          <div className="rounded px-2 py-1 text-xs text-white shadow-lg" style={{ backgroundColor: activeEvent.color }}>
            {activeEvent.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

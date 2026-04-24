"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  TableProperties,
  Menu,
} from "lucide-react";
import MonthPicker from "@/components/layout/month-picker";
import PageHeader from "@/components/layout/page-header";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useWeather } from "@/hooks/use-weather";
import { useEventTags } from "@/hooks/use-event-tags";
import { useCalendarShares } from "@/hooks/use-calendar-shares";
import { useVisibleUserIds } from "@/hooks/use-visible-user-ids";
import CalendarView from "@/components/calendar/calendar-view";
import DatabaseView from "@/components/calendar/database-view";
import EventForm from "@/components/calendar/event-form";
import DayDetail from "@/components/calendar/day-detail";
import RepeatScopeDialog, { type RepeatScope } from "@/components/calendar/repeat-scope-dialog";
import { useAppUsers } from "@/lib/current-user";
import { getHolidayMap } from "@/lib/holidays";
import type { CalendarEvent } from "@/types";

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarPageInner />
    </Suspense>
  );
}

function CalendarPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  type View = "calendar" | "database";
  const view: View = viewParam === "database" ? "database" : "calendar";
  const setView = (v: View) => {
    const url = v === "calendar" ? "/calendar" : "/calendar?view=database";
    router.push(url, { scroll: false });
  };

  // /travel 페이지에서 onNavigateToMonth 로 이동 시 ?y=..&m=.. 로 넘어옴.
  // 초기값 + 쿼리 변화 모두 반영.
  const yParam = searchParams.get("y");
  const mParam = searchParams.get("m");
  const now = new Date();
  const [year, setYear] = useState(() =>
    yParam ? parseInt(yParam, 10) : now.getFullYear()
  );
  const [month, setMonth] = useState(() =>
    mParam ? parseInt(mParam, 10) : now.getMonth() + 1
  );
  useEffect(() => {
    if (yParam) {
      const y = parseInt(yParam, 10);
      if (!Number.isNaN(y)) setYear(y);
    }
    if (mParam) {
      const m = parseInt(mParam, 10);
      if (!Number.isNaN(m)) setMonth(m);
    }
  }, [yParam, mParam]);

  const { users } = useAppUsers();
  const { viewableUserIds } = useCalendarShares();
  const { visibleUserIds, toggleVisible } = useVisibleUserIds();

  // 폼 (새 일정 / 수정)
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>("");

  // 날짜 상세
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");

  const {
    events,
    addEvent,
    addEventsBulk,
    updateEvent,
    updateEventSeries,
    deleteEvent,
    deleteEventSeries,
    batchUpdateSortOrder,
  } = useCalendarEvents(year, month, visibleUserIds);

  // 반복 일정 scope dialog 상태
  const [scopeDialog, setScopeDialog] = useState<
    | { kind: "edit"; anchor: CalendarEvent; pendingUpdates: Partial<Omit<CalendarEvent, "id" | "created_at">> }
    | { kind: "delete"; anchor: CalendarEvent }
    | null
  >(null);
  const { weatherMap } = useWeather(year, month);
  const { tags, addTag, deleteTag, updateTagColor, updateTagName } = useEventTags();

  const handleSave = async (data: Omit<CalendarEvent, "id" | "created_at">, repeatCount?: number) => {
    if (editing) {
      // 시리즈 일정 수정 → scope 선택 다이얼로그 표시
      if (editing.series_id) {
        setScopeDialog({ kind: "edit", anchor: editing, pendingUpdates: data });
        // 실제 저장은 scope 선택 후 진행 — form은 닫지 않기 위해 pending 반환
        return { error: null };
      }
      return await updateEvent(editing.id, data);
    }

    // 반복 일정: 원본 + 추가분을 한 번에 bulk insert (series_id로 묶음)
    if (repeatCount && (repeatCount > 1 || repeatCount === -1) && data.repeat) {
      const start = new Date(data.start_date + "T00:00:00");
      const end = data.end_date ? new Date(data.end_date + "T00:00:00") : null;
      const duration = end ? (end.getTime() - start.getTime()) : 0;

      // 무한(-1): weekly 260회(5년), monthly 120회(10년), yearly 30회(30년)
      let count = repeatCount;
      if (count === -1) {
        count = data.repeat === "weekly" ? 260 : data.repeat === "monthly" ? 120 : 30;
      }

      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      // 시리즈 ID 생성 — 모든 반복 일정을 묶어 수정/삭제할 때 사용
      const seriesId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `series_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const batch: (typeof data & { series_id?: string | null })[] = [
        { ...data, series_id: seriesId },
      ];
      for (let i = 1; i < count; i++) {
        const next = new Date(start);
        if (data.repeat === "weekly") next.setDate(start.getDate() + 7 * i);
        else if (data.repeat === "monthly") next.setMonth(start.getMonth() + i);
        else next.setFullYear(start.getFullYear() + i);

        const nextEnd = duration > 0 ? new Date(next.getTime() + duration) : null;
        batch.push({
          ...data,
          start_date: fmt(next),
          end_date: nextEnd ? fmt(nextEnd) : null,
          repeat: null,
          series_id: seriesId,
        });
      }

      return await addEventsBulk(batch);
    }

    // 단일 저장
    return await addEvent(data);
  };

  // 달력에서 날짜 클릭 → 일정 또는 공휴일 있으면 상세, 없으면 새 일정
  const handleDateClick = (date: string) => {
    const d = new Date(date + "T00:00:00");
    const hasEvents = events.some((ev) => {
      const start = new Date(ev.start_date + "T00:00:00");
      const end = ev.end_date ? new Date(ev.end_date + "T00:00:00") : start;
      return d >= start && d <= end;
    });
    const hasHoliday = !!getHolidayMap(d.getFullYear())[date];
    if (hasEvents || hasHoliday) {
      setSelectedDate(date);
      setDayDetailOpen(true);
    } else {
      setEditing(null);
      setDefaultDate(date);
      setFormOpen(true);
    }
  };

  // 날짜 상세에서 "새 일정 추가" 클릭
  const handleAddFromDay = () => {
    setEditing(null);
    setDefaultDate(selectedDate);
    setFormOpen(true);
  };

  // DB뷰에서 수정
  const handleEdit = (event: CalendarEvent) => {
    setEditing(event);
    setFormOpen(true);
  };

  // 삭제 — 시리즈 일정이면 scope 다이얼로그 띄우고, 아니면 바로 삭제
  const handleDelete = async (id: string) => {
    const target = events.find((e) => e.id === id);
    if (target && target.series_id) {
      setScopeDialog({ kind: "delete", anchor: target });
      return;
    }
    await deleteEvent(id);
  };

  const handleScopeConfirm = async (scope: RepeatScope) => {
    if (!scopeDialog) return;
    if (scopeDialog.kind === "edit") {
      await updateEventSeries(scopeDialog.anchor, scope, scopeDialog.pendingUpdates);
      setFormOpen(false);
      setEditing(null);
    } else {
      await deleteEventSeries(scopeDialog.anchor, scope);
    }
    setScopeDialog(null);
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [menuOpen]);

  const viewLabel = view === "calendar" ? "달력" : "일정목록";

  const viewMenuItems = [
    { key: "calendar" as const, label: "달력", icon: CalendarDays },
    { key: "database" as const, label: "일정목록", icon: TableProperties },
  ];

  return (
    <>
      <PageHeader
        title={viewLabel}
        showBell
        actions={
          <div className="flex items-center">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
                aria-label="메뉴"
              >
                <Menu className="h-[22px] w-[22px]" strokeWidth={1.6} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border bg-popover p-1 shadow-lg">
                  {viewMenuItems.map(({ key, label, icon: Icon }) => {
                    const active = view === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setView(key); setMenuOpen(false); }}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                          active ? "bg-accent font-medium" : "hover:bg-accent/50"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        }
      />
    <div className="flex flex-col min-h-0 h-[calc(100%-3.5rem)] overflow-hidden px-2 py-2 md:h-auto md:overflow-visible md:min-h-0 md:p-6">

      <div className="mb-2 flex justify-center items-center shrink-0">
        <MonthPicker
          year={year}
          month={month}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />
      </div>
      {/* 사용자 필터: 달력 탭에서만 노출 — 여기서 선택한 값이 일정목록에도 자동 적용 */}
      {view === "calendar" && viewableUserIds.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5 shrink-0">
          {users
            .filter((u) => viewableUserIds.includes(u.id))
            .map((u) => {
              const active = visibleUserIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleVisible(u.id)}
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all"
                  style={
                    active
                      ? {
                          borderColor: u.color,
                          backgroundColor: u.color + "20",
                          color: u.color,
                        }
                      : { opacity: 0.4 }
                  }
                >
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.avatar_url}
                      alt={u.name}
                      className="h-4 w-4 rounded-full object-cover"
                    />
                  ) : (
                    <span>{u.emoji || u.name[0]}</span>
                  )}
                  <span className="font-medium">{u.name}</span>
                </button>
              );
            })}
        </div>
      )}

      {view === "calendar" ? (
        // 데스크톱은 document 스크롤이라 부모가 h-auto → flex-1 이 0 이 되어 달력이 쪼그라듦.
        // calendar-md-height 는 globals.css 에 직접 정의된 @media (min-width:768px) 규칙으로
        // md+ 에서 height: 80vh 를 강제함. Tailwind arbitrary value 캐시 문제 회피.
        <div
          className="calendar-md-height"
          onTouchStart={(e) => {
            const t = e.touches[0];
            (e.currentTarget as HTMLDivElement & { _sx?: number; _sy?: number })._sx = t.clientX;
            (e.currentTarget as HTMLDivElement & { _sx?: number; _sy?: number })._sy = t.clientY;
          }}
          onTouchEnd={(e) => {
            const el = e.currentTarget as HTMLDivElement & { _sx?: number; _sy?: number };
            if (el._sx == null || el._sy == null) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - el._sx;
            const dy = t.clientY - el._sy;
            el._sx = undefined;
            el._sy = undefined;
            // 가로 스와이프 — 60px 이상 & 세로 이동보다 2배 이상 커야 월 이동
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) {
              if (dx < 0) {
                // 왼쪽으로 밀기 → 다음 월
                if (month === 12) {
                  setYear(year + 1);
                  setMonth(1);
                } else {
                  setMonth(month + 1);
                }
              } else {
                // 오른쪽으로 밀기 → 이전 월
                if (month === 1) {
                  setYear(year - 1);
                  setMonth(12);
                } else {
                  setMonth(month - 1);
                }
              }
            }
          }}
        >
        <CalendarView
          year={year}
          month={month}
          events={events}
          weatherMap={weatherMap}
          onDateClick={handleDateClick}
          onEventMove={async (eventId, newStart, newEnd) => {
            await updateEvent(eventId, { start_date: newStart, end_date: newEnd });
          }}
          onReorder={batchUpdateSortOrder}
        />
        </div>
      ) : (
        <DatabaseView
          events={events}
          weatherMap={weatherMap}
          tags={tags}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* 날짜 상세 모달 (달력 날짜 클릭 시) */}
      <DayDetail
        open={dayDetailOpen}
        onOpenChange={setDayDetailOpen}
        date={selectedDate}
        events={events}
        weather={weatherMap[selectedDate]}
        tags={tags}
        holiday={selectedDate ? getHolidayMap(new Date(selectedDate + "T00:00:00").getFullYear())[selectedDate] : undefined}
        onAddEvent={handleAddFromDay}
        onEditEvent={(ev) => { setDayDetailOpen(false); setEditing(ev); setFormOpen(true); }}
        onDeleteEvent={async (id) => { await handleDelete(id); }}
        onReorder={batchUpdateSortOrder}
      />

      {/* 일정 추가/수정 폼 */}
      <EventForm
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editing}
        defaultDate={defaultDate}
        tags={tags}
        onAddTag={addTag}
        onDeleteTag={deleteTag}
        onUpdateTagColor={updateTagColor}
        onRenameTag={updateTagName}
        weatherMap={weatherMap}
        onSave={handleSave}
        onBack={() => {
          if (editing) {
            setSelectedDate(editing.start_date);
            setDayDetailOpen(true);
          }
        }}
      />

      <RepeatScopeDialog
        open={!!scopeDialog}
        onOpenChange={(o) => { if (!o) setScopeDialog(null); }}
        action={scopeDialog?.kind === "delete" ? "삭제" : "수정"}
        onConfirm={handleScopeConfirm}
      />
    </div>
    </>
  );
}

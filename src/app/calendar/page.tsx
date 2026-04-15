"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  TableProperties,
  Plane,
} from "lucide-react";
import MonthPicker from "@/components/layout/month-picker";
import PageHeader from "@/components/layout/page-header";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useWeather } from "@/hooks/use-weather";
import { useEventTags } from "@/hooks/use-event-tags";
import { useCalendarShares } from "@/hooks/use-calendar-shares";
import CalendarView from "@/components/calendar/calendar-view";
import DatabaseView from "@/components/calendar/database-view";
import EventForm from "@/components/calendar/event-form";
import DayDetail from "@/components/calendar/day-detail";
import TravelList from "@/components/travel/travel-list";
import RepeatScopeDialog, { type RepeatScope } from "@/components/calendar/repeat-scope-dialog";
import { useCurrentUserId, useAppUsers } from "@/lib/current-user";
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
  const view: "calendar" | "database" | "travel" =
    viewParam === "database" || viewParam === "travel" ? viewParam : "calendar";
  const setView = (v: "calendar" | "database" | "travel") => {
    const params = new URLSearchParams(searchParams.toString());
    if (v === "calendar") params.delete("view");
    else params.set("view", v);
    const qs = params.toString();
    router.replace(qs ? `/calendar?${qs}` : "/calendar", { scroll: false });
  };
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const currentUserId = useCurrentUserId();
  const { users } = useAppUsers();
  const { viewableUserIds } = useCalendarShares();
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (currentUserId && visibleUserIds.length === 0) {
      setVisibleUserIds([currentUserId]);
    }
  }, [currentUserId, visibleUserIds.length]);

  const toggleVisible = (uid: string) => {
    setVisibleUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  // 폼 (새 일정 / 수정)
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>("");

  // 날짜 상세
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");


  const {
    events,
    loading,
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
  const { tags, addTag, deleteTag, updateTagColor } = useEventTags();

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

  // 달력에서 날짜 클릭 → 일정 있으면 상세, 없으면 바로 새 일정
  const handleDateClick = (date: string) => {
    const d = new Date(date + "T00:00:00");
    const hasEvents = events.some((ev) => {
      const start = new Date(ev.start_date + "T00:00:00");
      const end = ev.end_date ? new Date(ev.end_date + "T00:00:00") : start;
      return d >= start && d <= end;
    });
    if (hasEvents) {
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

  return (
    <>
      <PageHeader title="캘린더" />
    <div className="px-2 py-4 md:p-6 overflow-x-hidden">
      {/* 탭: 달력 / 일정목록 / 여행 */}
      <div className="mb-3 flex border-b">
        <button
          className={`flex items-center gap-1 md:gap-1.5 px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 transition-colors ${
            view === "calendar"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setView("calendar")}
        >
          <CalendarDays className="h-4 w-4" />
          달력
        </button>
        <button
          className={`flex items-center gap-1 md:gap-1.5 px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 transition-colors ${
            view === "database"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setView("database")}
        >
          <TableProperties className="h-4 w-4" />
          일정목록
        </button>
        <button
          className={`flex items-center gap-1 md:gap-1.5 px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 transition-colors ${
            view === "travel"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setView("travel")}
        >
          <Plane className="h-4 w-4" />
          여행
        </button>
      </div>

      {/* 탭 아래: MonthPicker + 사용자 필터 (달력/일정목록 탭에서만) */}
      {view !== "travel" && (
        <>
          <div className="mb-3 flex justify-center items-center">
            <MonthPicker
              year={year}
              month={month}
              onYearChange={setYear}
              onMonthChange={setMonth}
            />
          </div>
          {viewableUserIds.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
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
        </>
      )}

      {view === "travel" ? (
        <TravelList
          onNavigateToMonth={(y, m) => {
            setYear(y);
            setMonth(m);
            setView("calendar");
          }}
          onAddEvent={async (data) => {
            const result = await addEvent(data);
            if (!result.error) {
              const d = new Date(data.start_date + "T00:00:00");
              setYear(d.getFullYear());
              setMonth(d.getMonth() + 1);
            }
            return result;
          }}
          onAddEventTagToCalendar={addTag}
          onDeleteCalendarEventsByTitleDate={async (title, date) => {
            const { supabase } = await import("@/lib/supabase");
            const { data } = await supabase
              .from("calendar_events")
              .select("id")
              .eq("title", title)
              .eq("start_date", date);
            if (data) {
              for (const ev of data as { id: string }[]) {
                await deleteEvent(ev.id);
              }
            }
          }}
        />
      ) : loading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : view === "calendar" ? (
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

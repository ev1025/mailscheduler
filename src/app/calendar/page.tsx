"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  TableProperties,
  Plane,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import MonthPicker from "@/components/layout/month-picker";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useWeather } from "@/hooks/use-weather";
import { useEventTags } from "@/hooks/use-event-tags";
import { useCalendarShares } from "@/hooks/use-calendar-shares";
import CalendarView from "@/components/calendar/calendar-view";
import DatabaseView from "@/components/calendar/database-view";
import EventForm from "@/components/calendar/event-form";
import DayDetail from "@/components/calendar/day-detail";
import ShareManager from "@/components/calendar/share-manager";
import TravelList from "@/components/travel/travel-list";
import { useCurrentUserId, useAppUsers } from "@/lib/current-user";
import type { CalendarEvent } from "@/types";

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [view, setView] = useState<"calendar" | "database" | "travel">("calendar");
  const currentUserId = useCurrentUserId();
  const { users } = useAppUsers();
  const { viewableUserIds } = useCalendarShares();
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);

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


  const { events, loading, addEvent, updateEvent, deleteEvent, batchUpdateSortOrder } =
    useCalendarEvents(year, month, visibleUserIds);
  const { weatherMap } = useWeather(year, month);
  const { tags, addTag, deleteTag, updateTagColor } = useEventTags();

  const handleSave = async (data: Omit<CalendarEvent, "id" | "created_at">, repeatCount?: number) => {
    if (editing) {
      return await updateEvent(editing.id, data);
    }

    // 원본 저장
    const result = await addEvent(data);
    if (result.error) return result;

    // 반복 이벤트 생성 (-1 = 무한 → 타입별 기본값)
    if (repeatCount && (repeatCount > 1 || repeatCount === -1) && data.repeat) {
      const start = new Date(data.start_date + "T00:00:00");
      const end = data.end_date ? new Date(data.end_date + "T00:00:00") : null;
      const duration = end ? (end.getTime() - start.getTime()) : 0;

      // 무한(-1)인 경우: weekly 260회(5년), monthly 120회(10년), yearly 30회(30년)
      let count = repeatCount;
      if (count === -1) {
        count = data.repeat === "weekly" ? 260 : data.repeat === "monthly" ? 120 : 30;
      }

      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      for (let i = 1; i < count; i++) {
        const next = new Date(start);
        if (data.repeat === "weekly") next.setDate(start.getDate() + 7 * i);
        else if (data.repeat === "monthly") next.setMonth(start.getMonth() + i);
        else next.setFullYear(start.getFullYear() + i);

        const nextEnd = duration > 0 ? new Date(next.getTime() + duration) : null;

        await addEvent({
          ...data,
          start_date: fmt(next),
          end_date: nextEnd ? fmt(nextEnd) : null,
          repeat: null,
        });
      }
    }

    return result;
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

  // DB뷰에서 삭제 (DB뷰 내부 EventDetail에서 mode 전달)
  const handleDelete = async (id: string) => {
    await deleteEvent(id);
  };

  return (
    <div className="p-4 md:p-6">
      {/* 상단: MonthPicker + 사용자 토글 */}
      {view !== "travel" && (
        <>
          <div className="mb-3 flex justify-center">
            <MonthPicker
              year={year}
              month={month}
              onYearChange={setYear}
              onMonthChange={setMonth}
            />
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
            {viewableUserIds.length > 1 &&
              users
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareOpen(true)}
              className="h-7 text-xs"
            >
              <Share2 className="mr-1 h-3 w-3" />
              공유 관리
            </Button>
          </div>
        </>
      )}

      {/* 탭: 달력 / DB */}
      <div className="mb-4 flex border-b">
        <button
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
        onDeleteEvent={async (id) => { await deleteEvent(id); }}
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

      <ShareManager open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}

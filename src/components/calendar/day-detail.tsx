"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, Trash2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CalendarEvent, EventTag, WeatherData } from "@/types";
import { useTravelTags } from "@/hooks/use-travel-tags";
import { format, parseISO, isSameDay, isWithinInterval } from "date-fns";
import { ko } from "date-fns/locale";
import WeatherIcon from "./weather-icon";

interface DayDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  events: CalendarEvent[];
  weather?: WeatherData;
  tags?: EventTag[];
  onAddEvent: () => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (id: string) => void;
  onReorder?: (ids: string[]) => void;
}

function SortableItem({ ev, tagColorMap, onEdit, onDelete }: {
  ev: CalendarEvent;
  tagColorMap: Record<string, string>;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ev.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
    >
      {/* 드래그 핸들 */}
      <div
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* 일정 내용 (클릭 시 수정) */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onEdit?.(ev)}
      >
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
          <p className="font-medium text-sm truncate">{ev.title}</p>
        </div>
        <div className="flex items-center gap-2 mt-0.5 pl-5">
          {ev.start_time && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {ev.start_time.slice(0, 5)}
              {ev.end_time && ` ~ ${ev.end_time.slice(0, 5)}`}
            </span>
          )}
          {ev.tag && ev.tag.split(",").map((t) => {
            const c = tagColorMap[t] || "#6B7280";
            return (
              <Badge key={t} className="text-[10px] h-4 px-1.5" style={{ backgroundColor: c + "20", color: c, borderColor: c + "40" }}>
                {t}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* 삭제 */}
      {onDelete && (
        <button
          type="button"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={() => onDelete(ev.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default function DayDetail({
  open,
  onOpenChange,
  date,
  events,
  weather,
  tags: tagList = [],
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onReorder,
}: DayDetailProps) {
  const { tags: travelTags } = useTravelTags();
  const tagColorMap: Record<string, string> = {};
  for (const t of tagList) tagColorMap[t.name] = t.color;
  for (const t of travelTags) {
    if (!tagColorMap[t.name]) tagColorMap[t.name] = t.color;
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (!date) return null;

  const d = new Date(date + "T00:00:00");
  const dateLabel = format(d, "yyyy년 M월 d일 (EEEE)", { locale: ko });

  const dayEvents = events.filter((ev) => {
    const start = parseISO(ev.start_date);
    const end = ev.end_date ? parseISO(ev.end_date) : start;
    return isSameDay(d, start) || isSameDay(d, end) || isWithinInterval(d, { start, end });
  }).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id || !onReorder) return;
    const oldIdx = dayEvents.findIndex((ev) => ev.id === e.active.id);
    const newIdx = dayEvents.findIndex((ev) => ev.id === e.over!.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(dayEvents, oldIdx, newIdx);
    onReorder(reordered.map((ev) => ev.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-sm md:text-base whitespace-nowrap">
              {dateLabel}
            </DialogTitle>
            {weather && (
              <div className="shrink-0">
                <WeatherIcon weather={weather} showRange />
              </div>
            )}
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {dayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">일정이 없습니다</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={dayEvents.map((ev) => ev.id)} strategy={verticalListSortingStrategy}>
                {dayEvents.map((ev) => (
                  <SortableItem
                    key={ev.id}
                    ev={ev}
                    tagColorMap={tagColorMap}
                    onEdit={(e) => { onOpenChange(false); onEditEvent?.(e); }}
                    onDelete={onDeleteEvent}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
          <Button
            variant="outline"
            className="w-full mt-1"
            onClick={() => { onOpenChange(false); onAddEvent(); }}
          >
            <Plus className="mr-1 h-4 w-4" />
            새 일정 추가
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

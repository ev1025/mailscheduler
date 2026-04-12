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
import { Pencil, Trash2, Clock, Calendar } from "lucide-react";
import type { CalendarEvent, EventTag, WeatherData } from "@/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import WeatherIcon from "./weather-icon";

interface EventDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  weather?: WeatherData;
  tags?: EventTag[];
  onEdit: () => void;
  onDelete: (mode: "single" | "future") => void;
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const yy = String(d.getFullYear()).slice(2);
  return `${yy}/${d.getMonth() + 1}/${d.getDate()}(${format(d, "EEE", { locale: ko })})`;
}

export default function EventDetail({
  open,
  onOpenChange,
  event,
  weather,
  tags: tagList = [],
  onEdit,
  onDelete,
}: EventDetailProps) {
  const tagColorMap: Record<string, string> = {};
  for (const t of tagList) tagColorMap[t.name] = t.color;
  const [showDeleteChoice, setShowDeleteChoice] = useState(false);

  if (!event) return null;

  const isRepeating = !!event.repeat;

  const handleDeleteClick = () => {
    if (isRepeating) {
      setShowDeleteChoice(true);
    } else {
      onDelete("single");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setShowDeleteChoice(false); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        {!showDeleteChoice ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
                <DialogTitle>{event.title}</DialogTitle>
              </div>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {formatDateShort(event.start_date)}
                  {event.end_date && event.end_date !== event.start_date && (
                    <> ~ {formatDateShort(event.end_date)}</>
                  )}
                </span>
                {event.repeat && (
                  <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {event.repeat === "weekly" ? "매주" : event.repeat === "monthly" ? "매월" : "매년"}
                  </span>
                )}
                {weather && <WeatherIcon weather={weather} compact />}
              </div>

              {event.start_time && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {event.start_time.slice(0, 5)}
                    {event.end_time && ` ~ ${event.end_time.slice(0, 5)}`}
                  </span>
                </div>
              )}

              {event.tag && (
                <div className="flex flex-wrap gap-1">
                  {event.tag.split(",").map((t) => {
                    const c = tagColorMap[t] || "#6B7280";
                    return (
                      <Badge
                        key={t}
                        className="text-xs"
                        style={{ backgroundColor: c + "20", color: c, borderColor: c + "40" }}
                      >
                        {t}
                      </Badge>
                    );
                  })}
                </div>
              )}

              {event.description && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                  {event.description}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDeleteClick}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  삭제
                </Button>
                <Button size="sm" onClick={onEdit}>
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  수정
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>반복 일정 삭제</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">이 일정은 반복 일정입니다. 어떻게 삭제할까요?</p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="justify-start h-auto py-3 px-4"
                  onClick={() => { setShowDeleteChoice(false); onDelete("single"); }}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium">이 일정만 삭제</p>
                    <p className="text-xs text-muted-foreground mt-0.5">선택한 일정 1개만 삭제합니다</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start h-auto py-3 px-4 text-destructive hover:text-destructive"
                  onClick={() => { setShowDeleteChoice(false); onDelete("future"); }}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium">이후 동일 일정 모두 삭제</p>
                    <p className="text-xs text-muted-foreground mt-0.5">이 날짜 이후 같은 제목의 일정을 모두 삭제합니다</p>
                  </div>
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteChoice(false)}>취소</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

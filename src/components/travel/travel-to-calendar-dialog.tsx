"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import DatePicker from "@/components/ui/date-picker";
import TimePicker from "@/components/ui/time-picker";
import { Badge } from "@/components/ui/badge";
import { X, ArrowLeft } from "lucide-react";
import type { TravelItem, TravelTag, EventTag } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TravelItem | null;
  travelTags?: TravelTag[];
  eventTags?: EventTag[];
  onAddToCalendar: (date: string, endDate: string | null, startTime: string | null, endTime: string | null) => Promise<void>;
}

const CATEGORY_COLORS: Record<string, string> = {
  자연: "#22C55E",
  숙소: "#A855F7",
  식당: "#F59E0B",
  놀거리: "#3B82F6",
  기타: "#6B7280",
};

export default function TravelToCalendarDialog({
  open, onOpenChange, item, travelTags = [], eventTags = [], onAddToCalendar,
}: Props) {
  const today = new Date().toISOString().split("T")[0];
  const nowTime = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

  const [date, setDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [showEndDate, setShowEndDate] = useState(false);
  const [startTime, setStartTime] = useState(nowTime);
  const [endTime, setEndTime] = useState("");
  const [showEndTime, setShowEndTime] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const t = new Date();
      setDate(t.toISOString().split("T")[0]);
      setEndDate("");
      setShowEndDate(false);
      setStartTime(`${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`);
      setEndTime("");
      setShowEndTime(false);
    }
  }, [open]);

  if (!item) return null;

  // 태그 색상 맵 (일정 + 여행)
  const tagColorMap: Record<string, string> = {};
  for (const t of eventTags) tagColorMap[t.name] = t.color;
  for (const t of travelTags) tagColorMap[t.name] = t.color;

  // 일정 태그 / 여행 태그 분리
  const eventTagNames = new Set(eventTags.map((t) => t.name));
  const itemTags = item.tag ? item.tag.split(",") : [];
  const itemEventTags = itemTags.filter((t) => eventTagNames.has(t));
  const itemTravelTags = itemTags.filter((t) => !eventTagNames.has(t));

  const categoryColor = CATEGORY_COLORS[item.category] || "#6B7280";

  const handleSubmit = async () => {
    setSaving(true);
    await onAddToCalendar(date, endDate || null, startTime || null, endTime || null);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showBackButton={false}>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="뒤로"
          className="absolute top-2 right-2 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <DialogHeader>
          <DialogTitle>달력에 추가</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {/* 제목 + 지역 (이모지 제거, 연한 회색) */}
          <div className="flex items-baseline gap-2">
            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color || "#3B82F6" }} />
            <span className="text-base font-semibold">{item.title}</span>
            {item.region && <span className="text-xs text-muted-foreground/60">{item.region}</span>}
          </div>

          {/* 분류 + 일정 태그 + 여행 태그 (색상 표시) */}
          <div className="flex flex-wrap gap-1.5">
            <Badge
              className="text-[11px]"
              style={{ backgroundColor: categoryColor + "20", color: categoryColor, borderColor: categoryColor + "40" }}
            >
              {item.category}
            </Badge>
            {itemEventTags.map((t) => {
              const c = tagColorMap[t] || "#6B7280";
              return (
                <Badge
                  key={t}
                  className="text-[11px]"
                  style={{ backgroundColor: c + "20", color: c, borderColor: c + "40" }}
                >
                  {t}
                </Badge>
              );
            })}
            {itemTravelTags.map((t) => {
              const c = tagColorMap[t] || "#6B7280";
              return (
                <Badge
                  key={t}
                  className="text-[11px]"
                  style={{ backgroundColor: c + "20", color: c, borderColor: c + "40" }}
                >
                  {t}
                </Badge>
              );
            })}
          </div>

          {/* 내용 (분간되도록 박스 + 라벨) */}
          {item.notes && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">내용</Label>
              <div className="rounded-md border bg-muted/30 p-2.5 text-xs whitespace-pre-wrap">
                {item.notes}
              </div>
            </div>
          )}

          {/* 날짜 — 날짜/시간 행과 동일한 grid 적용 */}
          <div className="flex items-center gap-2">
            <Label className="w-12 shrink-0 text-xs text-muted-foreground">날짜</Label>
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1 flex-1 min-w-0">
              <DatePicker value={date} onChange={setDate} className="h-8 min-w-0 text-xs" />
              <span className="text-xs text-muted-foreground">~</span>
              {showEndDate ? (
                <DatePicker value={endDate} onChange={setEndDate} min={date} className="h-8 min-w-0 text-xs" />
              ) : (
                <button type="button" className="h-8 min-w-0 rounded-md border border-dashed text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground transition-colors px-1" onClick={() => setShowEndDate(true)}>
                  종료 설정
                </button>
              )}
              {showEndDate ? (
                <button type="button" className="text-muted-foreground hover:text-foreground shrink-0 p-0.5" onClick={() => { setShowEndDate(false); setEndDate(""); }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="w-4" />
              )}
            </div>
          </div>

          {/* 시간 */}
          <div className="flex items-center gap-2">
            <Label className="w-12 shrink-0 text-xs text-muted-foreground">시간</Label>
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1 flex-1 min-w-0">
              <TimePicker value={startTime} onChange={setStartTime} className="h-8 min-w-0 text-xs" />
              <span className="text-xs text-muted-foreground">~</span>
              {showEndTime ? (
                <TimePicker value={endTime} onChange={setEndTime} className="h-8 min-w-0 text-xs" />
              ) : (
                <button type="button" className="h-8 min-w-0 rounded-md border border-dashed text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground transition-colors px-1" onClick={() => setShowEndTime(true)}>
                  종료 설정
                </button>
              )}
              {showEndTime ? (
                <button type="button" className="text-muted-foreground hover:text-foreground shrink-0 p-0.5" onClick={() => { setShowEndTime(false); setEndTime(""); }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="w-4" />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "추가 중..." : "캘린더에 추가"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

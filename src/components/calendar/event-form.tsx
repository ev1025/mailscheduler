"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Save, Plus, X, ArrowLeft } from "lucide-react";
import TimePicker from "@/components/ui/time-picker";
import NumberWheel from "@/components/ui/number-wheel";
import ColorPickerPanel from "@/components/ui/color-picker";
import WeatherIcon from "./weather-icon";
import DatePicker from "@/components/ui/date-picker";
import TagInput from "@/components/ui/tag-input";
import { useAppUsers, useCurrentUserId } from "@/lib/current-user";
import type { CalendarEvent, EventTag, RepeatType } from "@/types";

const COLORS = [
  "#3B82F6", "#EF4444", "#22C55E", "#F59E0B",
  "#A855F7", "#EC4899", "#06B6D4", "#6B7280",
];

const TAG_PALETTE = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9",
  "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
];

function randomTagColor(): string {
  return TAG_PALETTE[Math.floor(Math.random() * TAG_PALETTE.length)];
}

function ColorPickerPopover({ color, onChange, isCustom }: { color: string; onChange: (c: string) => void; isCustom: boolean }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(color);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setPreview(color); }}>
      <PopoverTrigger
        className={`h-5 w-5 rounded-full cursor-pointer transition-all ${
          isCustom || open ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-110"
        }`}
        style={{ background: open ? preview : isCustom ? color : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
      />
      <PopoverContent className="w-[220px] p-3" align="start" side="bottom">
        <ColorPickerPanel
          color={color}
          onPreview={setPreview}
          onConfirm={(c) => { onChange(c); setOpen(false); }}
        />
      </PopoverContent>
    </Popover>
  );
}

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: "none", label: "반복 안 함" },
  { value: "weekly", label: "매주" },
  { value: "monthly", label: "매월" },
  { value: "yearly", label: "매년" },
];

const DRAFTS_KEY = "event-drafts";

interface DraftData {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  color: string;
  tag: string;
  repeat: RepeatType;
  savedAt: string;
}

function loadDrafts(): DraftData[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveDrafts(drafts: DraftData[]) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: string;
  tags: EventTag[];
  onAddTag?: (name: string, color: string) => Promise<{ error: unknown }>;
  onDeleteTag?: (id: string) => Promise<{ error: unknown }>;
  onUpdateTagColor?: (id: string, color: string) => Promise<{ error: unknown }>;
  weatherMap?: Record<string, import("@/types").WeatherData>;
  onSave: (data: Omit<CalendarEvent, "id" | "created_at">, repeatCount?: number) => Promise<{ error: unknown }>;
  onBack?: () => void;
}

export default function EventForm({
  open,
  onOpenChange,
  event,
  defaultDate,
  tags,
  onAddTag,
  onDeleteTag,
  onUpdateTagColor,
  weatherMap,
  onSave,
  onBack,
}: EventFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [repeat, setRepeat] = useState<RepeatType>("none");
  const [repeatCount, setRepeatCount] = useState(-1);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<DraftData[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const currentUserId = useCurrentUserId();
  const { users } = useAppUsers();

  useEffect(() => {
    if (!open) return;
    setDrafts(loadDrafts());

    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setStartDate(event.start_date);
      setEndDate(event.end_date || "");
      setStartTime(event.start_time || "");
      setEndTime(event.end_time || "");
      setColor(event.color);
      setSelectedTags(event.tag ? event.tag.split(",") : []);
      setRepeat((event.repeat as RepeatType) || "none");
      setRepeatCount(-1);

      setShowEndDate(!!event.end_date);
      setShowEndTime(!!event.end_time);
      setSharedWith(
        (event as unknown as { shared_with?: string[] | null }).shared_with ||
          []
      );
    } else {
      resetForm();
      setSharedWith([]);
    }
    setShowDrafts(false);
  }, [event, defaultDate, open]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setStartDate(defaultDate || new Date().toISOString().split("T")[0]);
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setColor(COLORS[0]);
    setSelectedTags([]);
    setRepeat("none");
    setRepeatCount(-1);
    setShowEndDate(false);
    setShowEndTime(false);
  }

  function handleSaveDraft() {
    if (!title.trim()) return;
    const draft: DraftData = {
      id: Date.now().toString(),
      title, description, startDate, endDate, startTime, endTime,
      color, tag: selectedTags.join(","), repeat,
      savedAt: new Date().toISOString(),
    };
    const updated = [draft, ...drafts].slice(0, 10); // 최대 10건
    saveDrafts(updated);
    setDrafts(updated);
  }

  function handleLoadDraft(draft: DraftData) {
    setTitle(draft.title);
    setDescription(draft.description);
    setStartDate(draft.startDate || defaultDate || new Date().toISOString().split("T")[0]);
    setEndDate(draft.endDate);
    setStartTime(draft.startTime);
    setEndTime(draft.endTime);
    setColor(draft.color || COLORS[0]);
    setSelectedTags(draft.tag ? draft.tag.split(",") : []);
    setRepeat(draft.repeat || "none");
    setShowEndDate(!!draft.endDate);
    setShowEndTime(!!draft.endTime);
    setShowDrafts(false);
  }

  function handleDeleteDraft(id: string) {
    const updated = drafts.filter((d) => d.id !== id);
    saveDrafts(updated);
    setDrafts(updated);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;

    setSaving(true);
    const rc = repeat !== "none" && !event ? repeatCount : undefined;
    const { error } = await onSave(
      {
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        color,
        tag: selectedTags.length > 0 ? selectedTags.join(",") : null,
        repeat: repeat === "none" ? null : repeat,
        ...(sharedWith.length > 0 ? { shared_with: sharedWith } : {}),
      } as Omit<CalendarEvent, "id" | "created_at">,
      rc
    );
    setSaving(false);
    if (!error) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onBack && event && (
                <button type="button" onClick={() => { onOpenChange(false); onBack(); }} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <DialogTitle>{event ? "일정 수정" : "새 일정"}</DialogTitle>
            </div>
            {weatherMap && startDate && weatherMap[startDate] && (
              <WeatherIcon weather={weatherMap[startDate]} showRange />
            )}
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 제목 */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="일정 제목 *"
            className="h-9"
            autoFocus
          />

          {/* 색상 */}
          <div className="flex items-center gap-2">
            <Label className="w-12 shrink-0 text-xs text-muted-foreground">색상</Label>
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-5 w-5 rounded-full transition-all ${
                    color === c ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              {/* 커스텀 컬러피커 */}
              <ColorPickerPopover color={color} onChange={setColor} isCustom={!COLORS.includes(color)} />
            </div>
          </div>

          {/* 날짜 */}
          <div className="flex items-center gap-2">
            <Label className="w-12 shrink-0 text-xs text-muted-foreground">날짜</Label>
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1 flex-1 min-w-0">
              <DatePicker value={startDate} onChange={setStartDate} className="h-8 min-w-0 text-xs" />
              <span className="text-xs text-muted-foreground">~</span>
              {showEndDate ? (
                <DatePicker value={endDate} onChange={setEndDate} className="h-8 min-w-0 text-xs" />
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

          {/* 반복 — 날짜 행과 동일한 grid로 정렬 */}
          <div className="flex items-center gap-2">
            <Label className="w-12 shrink-0 text-xs text-muted-foreground">반복</Label>
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1 flex-1 min-w-0">
              <Select value={repeat} onValueChange={(v) => {
                if (v) setRepeat(v as RepeatType);
              }}>
                <SelectTrigger className="h-8 w-full min-w-0 text-xs">
                  {REPEAT_OPTIONS.find((o) => o.value === repeat)?.label || "반복 안 함"}
                </SelectTrigger>
                <SelectContent>
                  {REPEAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {repeat !== "none" ? (
                <>
                  <span className="text-[11px] text-muted-foreground px-0.5">횟수</span>
                  <NumberWheel value={repeatCount} onChange={setRepeatCount} min={1} max={52} allowInfinity />
                  <span className="w-4" />
                </>
              ) : (
                <>
                  <span />
                  <span />
                  <span className="w-4" />
                </>
              )}
            </div>
          </div>

          {/* 태그 */}
          <div className="flex flex-col gap-1.5">
            <Label>태그</Label>
            <TagInput
              selectedTags={selectedTags}
              allTags={tags}
              onChange={setSelectedTags}
              onAddTag={onAddTag}
              onDeleteTag={onDeleteTag}
              onUpdateTagColor={onUpdateTagColor}
            />
          </div>


          {/* 설명 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-desc">설명</Label>
            <Textarea
              id="event-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="일정 설명"
              rows={3}
            />
          </div>

          {/* 버튼 */}
          <div className="flex items-center justify-between pt-1">
            {/* 임시저장 목록 (건수 있을 때만) */}
            {!event && drafts.length > 0 ? (
              <div className="relative">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowDrafts(!showDrafts)}
                >
                  임시저장 {drafts.length}건
                </button>
                {showDrafts && (
                  <div className="absolute bottom-full left-0 mb-1 w-56 rounded-md border bg-popover shadow-lg z-50 max-h-[200px] overflow-y-auto">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b">
                      <button type="button" onClick={() => setShowDrafts(false)} className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-3 w-3" />
                      </button>
                      <span className="text-[10px] text-muted-foreground font-medium">임시저장 목록</span>
                    </div>
                    {drafts.map((d) => (
                      <div key={d.id} className="group flex items-center justify-between px-3 py-2 hover:bg-accent cursor-pointer" onClick={() => handleLoadDraft(d)}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{d.title || "(제목 없음)"}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(d.savedAt).toLocaleDateString("ko")}</p>
                        </div>
                        <button
                          type="button"
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
                          onClick={(e) => { e.stopPropagation(); handleDeleteDraft(d.id); }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : <div />}
            <div className="flex gap-2">
              {!event && (
                <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={!title.trim()}>
                  임시저장
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={!title.trim() || !startDate || saving}>
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

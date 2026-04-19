"use client";

import { useEffect, useState } from "react";
import { X, MapPin } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import TimePicker from "@/components/ui/time-picker";
import TagInput from "@/components/ui/tag-input";
import PlanPlacePicker from "@/components/travel/plan-place-picker";
import { useTravelTags } from "@/hooks/use-travel-tags";
import type { TravelPlanTask, PlaceInfo } from "@/types";

// 바텀시트에서 일정을 편집. 모바일 키보드가 시트만 올리고 지도를 가리지 않도록
// Sheet 자체의 --kb-offset 자동 보정 사용. 저장 버튼으로 DB 반영.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 편집용 기존 task. null 이면 신규(day_index 사용)
  task: TravelPlanTask | null;
  defaultDayIndex: number;
  availableDays: number[];
  formatDayLabel: (day: number) => string;
  onAddNewDay: () => number;
  onSave: (
    updates: Partial<Omit<TravelPlanTask, "id" | "plan_id" | "created_at">>
  ) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export default function PlanTaskSheet({
  open,
  onOpenChange,
  task,
  defaultDayIndex,
  availableDays,
  formatDayLabel,
  onAddNewDay,
  onSave,
  onDelete,
}: Props) {
  const { tags, addTag, deleteTag, updateTagColor } = useTravelTags();

  const [dayIndex, setDayIndex] = useState(defaultDayIndex);
  const [startTime, setStartTime] = useState("");
  const [stayMinutes, setStayMinutes] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState<string | null>(null);
  const [placeLat, setPlaceLat] = useState<number | null>(null);
  const [placeLng, setPlaceLng] = useState<number | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  // open 될 때마다 state 초기화
  useEffect(() => {
    if (!open) return;
    if (task) {
      setDayIndex(task.day_index);
      // DB TIME 타입은 "HH:MM:SS" 로 내려옴 → HH:MM 로 정규화해 TimePicker 에 전달
      setStartTime(task.start_time ? task.start_time.slice(0, 5) : "");
      setStayMinutes(String(task.stay_minutes || ""));
      setPlaceName(task.place_name);
      setPlaceAddress(task.place_address);
      setPlaceLat(task.place_lat);
      setPlaceLng(task.place_lng);
      setSelectedTags(task.tag ? task.tag.split(",").map((s) => s.trim()).filter(Boolean) : []);
      setContent(task.content ?? "");
    } else {
      setDayIndex(defaultDayIndex);
      setStartTime("");
      setStayMinutes("");
      setPlaceName("");
      setPlaceAddress(null);
      setPlaceLat(null);
      setPlaceLng(null);
      setSelectedTags([]);
      setContent("");
    }
    setPlaceQuery("");
  }, [open, task, defaultDayIndex]);

  const handlePickPlace = (p: PlaceInfo) => {
    setPlaceName(p.name);
    setPlaceAddress(p.address);
    setPlaceLat(p.lat);
    setPlaceLng(p.lng);
  };

  const handleDayChange = (v: string | null) => {
    if (!v) return;
    if (v === "__new__") setDayIndex(onAddNewDay());
    else setDayIndex(parseInt(v));
  };

  const handleStayChange = (v: string) => {
    // 숫자만 허용 — 분 단위 강제
    const cleaned = v.replace(/[^0-9]/g, "");
    setStayMinutes(cleaned);
  };

  const handleSubmit = async () => {
    setSaving(true);
    const n = parseInt(stayMinutes, 10);
    await onSave({
      day_index: dayIndex,
      start_time: startTime || null,
      place_name: placeName,
      place_address: placeAddress,
      place_lat: placeLat,
      place_lng: placeLng,
      tag: selectedTags.length > 0 ? selectedTags.join(",") : null,
      content: content.trim() || null,
      stay_minutes: Number.isFinite(n) && n > 0 ? n : 0,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] max-h-[90dvh] overflow-y-auto"
        showBackButton={false}
        showCloseButton={false}
        initialFocus={false}
      >
        <SheetHeader className="pt-2 shrink-0">
          <div className="flex flex-col items-center">
            <div className="h-1.5 w-14 rounded-full bg-muted-foreground/40 mb-3" />
          </div>
          <SheetTitle className="text-base">
            {task ? "일정 수정" : "새 일정"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-3">
          {/* 일차 · 시간 */}
          <div className="flex items-center gap-2">
            <Label className="w-14 shrink-0 text-xs text-muted-foreground">일차</Label>
            <Select value={String(dayIndex)} onValueChange={handleDayChange}>
              <SelectTrigger className="h-8 w-28 text-xs">
                {formatDayLabel(dayIndex)}
              </SelectTrigger>
              <SelectContent>
                {availableDays.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {formatDayLabel(d)}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">+ 새 일자</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Label className="shrink-0 text-xs text-muted-foreground">시간</Label>
            <TimePicker
              value={startTime}
              onChange={setStartTime}
              className="h-8 w-24 text-xs"
            />
          </div>

          {/* 체류 시간 — 분 단위 명시 */}
          <div className="flex items-center gap-2">
            <Label className="w-14 shrink-0 text-xs text-muted-foreground">체류</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={stayMinutes}
              onChange={(e) => handleStayChange(e.target.value)}
              placeholder="0"
              className="h-8 w-24 text-xs"
            />
            <span className="text-xs text-muted-foreground">분</span>
          </div>

          {/* 장소 */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">장소</Label>
            {placeName && placeLat != null ? (
              <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{placeName}</div>
                  {placeAddress && (
                    <div className="text-xs text-muted-foreground truncate">{placeAddress}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPlaceName("");
                    setPlaceAddress(null);
                    setPlaceLat(null);
                    setPlaceLng(null);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  변경
                </button>
              </div>
            ) : (
              <PlanPlacePicker
                value={placeQuery}
                onChange={setPlaceQuery}
                onPick={handlePickPlace}
                placeholder="장소명·지역 (예: 성산일출봉)"
              />
            )}
          </div>

          {/* 태그 — 기존 TagInput 컴포넌트 재사용 (이벤트 폼과 동일) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">태그</Label>
            <TagInput
              selectedTags={selectedTags}
              allTags={tags}
              onChange={setSelectedTags}
              onAddTag={addTag}
              onDeleteTag={deleteTag}
              onUpdateTagColor={updateTagColor}
              orderKey="tag-order:travel-plan-tags"
            />
          </div>

          {/* 내용 */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">내용</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="어디에 갈지, 무엇을 할지 (예: 일출 보기)"
              rows={2}
              className="text-xs"
            />
          </div>

          {/* 버튼 */}
          <div className="flex items-center gap-2 pt-1">
            {task && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  await onDelete();
                  onOpenChange(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !placeName.trim()}
            >
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

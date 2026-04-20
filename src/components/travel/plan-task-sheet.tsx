"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
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
  // 작성 세션 draft 를 구분할 키 (보통 planId). 같은 task/신규 슬롯에 대해
  // 시트 닫았다 다시 열어도 로컬에 저장된 입력 값을 복원.
  planId: string;
}

interface SheetDraft {
  dayIndex: number;
  startTime: string;
  stayMinutes: string;
  placeName: string;
  placeAddress: string | null;
  placeLat: number | null;
  placeLng: number | null;
  selectedTags: string[];
  content: string;
}

const DRAFT_PREFIX = "plan_task_draft:";

function draftKeyFor(planId: string, task: TravelPlanTask | null, defaultDayIndex: number) {
  return task
    ? `${DRAFT_PREFIX}${planId}:task:${task.id}`
    : `${DRAFT_PREFIX}${planId}:new:${defaultDayIndex}`;
}

function readDraft(key: string): SheetDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as SheetDraft;
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: SheetDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {}
}

function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {}
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
  planId,
}: Props) {
  const draftKey = draftKeyFor(planId, task, defaultDayIndex);
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

  // open 될 때마다 state 초기화 — DB 값이 기준, 단 localStorage draft 가 있으면 덮어씀
  useEffect(() => {
    if (!open) return;
    if (task) {
      setDayIndex(task.day_index);
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
    // 작성 세션 draft 복원 (있으면)
    const d = readDraft(draftKey);
    if (d) {
      setDayIndex(d.dayIndex);
      setStartTime(d.startTime);
      setStayMinutes(d.stayMinutes);
      setPlaceName(d.placeName);
      setPlaceAddress(d.placeAddress);
      setPlaceLat(d.placeLat);
      setPlaceLng(d.placeLng);
      setSelectedTags(d.selectedTags);
      setContent(d.content);
    }
  }, [open, task, defaultDayIndex, draftKey]);

  // 시트 열려있는 동안 편집 내용을 500ms debounce 로 localStorage 에 저장
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      writeDraft(draftKey, {
        dayIndex,
        startTime,
        stayMinutes,
        placeName,
        placeAddress,
        placeLat,
        placeLng,
        selectedTags,
        content,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    open,
    draftKey,
    dayIndex,
    startTime,
    stayMinutes,
    placeName,
    placeAddress,
    placeLat,
    placeLng,
    selectedTags,
    content,
  ]);

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
    clearDraft(draftKey); // 저장 완료 → draft 폐기
    onOpenChange(false);
  };

  return (
    // modal={false} — Sheet focus-trap 해제. 내부에 TagInput(또 다른 Sheet/Popover)
    // 을 중첩해 열 때 포커스 충돌로 클릭이 먹지 않는 문제 해결.
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="bottom"
        // height 고정(90dvh) — "중간 고정" 느낌 해소, pull-to-refresh 방지(overscroll-contain)
        className="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] overflow-y-auto overscroll-contain"
        style={{ height: "90dvh" }}
        showBackButton={false}
        showCloseButton={false}
        initialFocus={false}
      >
        {/* 데스크톱: 중앙 정렬 + 최대 폭 제한 / 모바일: 전폭 */}
        <div className="mx-auto w-full max-w-xl flex flex-col">
        <SheetHeader className="pt-2 shrink-0">
          <div className="flex flex-col items-center">
            <div className="h-1.5 w-14 rounded-full bg-muted-foreground/40 mb-3" />
          </div>
          <SheetTitle className="text-base">
            {task ? "일정 수정" : "새 일정"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-3">
          {/* 일차 · 시간 · 체류 — 1행 */}
          <div className="flex items-center gap-2 flex-wrap">
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

            {/* 시간 — 기존 TimePicker (캘린더와 동일) */}
            <TimePicker
              value={startTime}
              onChange={setStartTime}
              className="h-8 w-24 text-xs"
            />

            <div className="flex items-center gap-1">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                maxLength={3}
                value={stayMinutes}
                onChange={(e) => handleStayChange(e.target.value)}
                placeholder="체류"
                className="h-8 w-14 text-xs"
              />
              <span className="text-xs text-muted-foreground">분</span>
            </div>
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

          {/* 버튼 — 삭제는 메인 목록 행의 휴지통에서 */}
          <div className="flex items-center justify-end gap-2 pt-1">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useTravelCategories, BUILTIN_TRAVEL_CATEGORIES } from "@/hooks/use-travel-categories";
import { useEventTags } from "@/hooks/use-event-tags";
import { useMediaQuery } from "@/lib/use-media-query";
import type { TravelPlanTask, PlaceInfo } from "@/types";

// 일정 편집 UI.
// - 모바일(<768px): 하단 바텀시트(90dvh)
// - 데스크톱(>=768px): 중앙 모달 다이얼로그(max-w-lg)

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
  category: string;     // 분류 (단일)
  tags: string[];       // 태그 (복수) — event_tags 공용 풀
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
  // 분류(단일) · 태그(복수) 분리. 분류 풀은 localStorage, 태그 풀은 event_tags(DB).
  const { categories, colors, addCategory, deleteCategory, updateCategoryColor, updateCategoryName } =
    useTravelCategories();
  const { tags: allEventTags, addTag: addEventTag, deleteTag: deleteEventTag, updateTagColor: updateEventTagColor } =
    useEventTags();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [dayIndex, setDayIndex] = useState(defaultDayIndex);
  const [startTime, setStartTime] = useState("");
  const [stayMinutes, setStayMinutes] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState<string | null>(null);
  const [placeLat, setPlaceLat] = useState<number | null>(null);
  const [placeLng, setPlaceLng] = useState<number | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [editingPlace, setEditingPlace] = useState(false);
  // 분류 1개 (빈 문자열이면 미선택)
  const [category, setCategory] = useState<string>("");
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
      // 분류: 새 category 컬럼 우선, 없으면 null. 태그: tag 컬럼 (콤마구분).
      setCategory(task.category ?? "");
      setSelectedTags(
        task.tag ? task.tag.split(",").map((s) => s.trim()).filter(Boolean) : []
      );
      setContent(task.content ?? "");
    } else {
      setDayIndex(defaultDayIndex);
      setStartTime("");
      setStayMinutes("");
      setPlaceName("");
      setPlaceAddress(null);
      setPlaceLat(null);
      setPlaceLng(null);
      setCategory("");
      setSelectedTags([]);
      setContent("");
    }
    setPlaceQuery("");
    setEditingPlace(false);
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
      setCategory(d.category ?? "");
      setSelectedTags(d.tags ?? []);
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
        category,
        tags: selectedTags,
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
    category,
    selectedTags,
    content,
  ]);

  const handlePickPlace = (p: PlaceInfo) => {
    setPlaceName(p.name);
    setPlaceAddress(p.address);
    setPlaceLat(p.lat);
    setPlaceLng(p.lng);
    setPlaceQuery("");
    setEditingPlace(false);
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
      category: category.trim() || null,
      content: content.trim() || null,
      stay_minutes: Number.isFinite(n) && n > 0 ? n : 0,
    });
    setSaving(false);
    clearDraft(draftKey); // 저장 완료 → draft 폐기
    onOpenChange(false);
  };

  // 폼 본문 — Sheet(모바일)·Dialog(데스크탑) 공통. 드래그 핸들은 모바일만.
  const renderForm = () => (
    <>
        <div className="flex flex-col gap-3 px-4 pb-3">
          {/* 일차 · 시간 · 체류 — 1행 */}
          {/* 일자 · 시간 · 체류 — 명시적 폭으로 안정적 클릭 영역 확보 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={String(dayIndex)} onValueChange={handleDayChange}>
              <SelectTrigger className="h-8 text-xs min-w-[92px]">
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

            <TimePicker
              value={startTime}
              onChange={setStartTime}
              className="h-8 text-xs min-w-[88px]"
            />

            <Input
              type="number"
              inputMode="numeric"
              min={0}
              maxLength={3}
              value={stayMinutes}
              onChange={(e) => handleStayChange(e.target.value)}
              placeholder="체류(분)"
              className="h-8 text-xs w-20"
            />
          </div>

          {/* 장소 — 선택된 값이 있으면 카드(탭 시 검색창으로 전환, 기존 이름을
              쿼리로 주입). 검색창 포커스 잃으면 기존 값 유지하며 카드 복귀. */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">장소</Label>
            {placeName && placeLat != null && !editingPlace ? (
              <button
                type="button"
                onClick={() => {
                  setPlaceQuery(placeName);
                  setEditingPlace(true);
                }}
                className="flex items-start gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{placeName}</div>
                  {placeAddress && (
                    <div className="text-xs text-muted-foreground truncate">{placeAddress}</div>
                  )}
                </div>
              </button>
            ) : (
              <PlanPlacePicker
                value={placeQuery}
                onChange={setPlaceQuery}
                onPick={handlePickPlace}
                onBlur={() => {
                  // 결과 선택 없이 외부로 포커스 이동 → 기존 값 유지한 채 카드 복귀
                  if (editingPlace) {
                    setEditingPlace(false);
                    setPlaceQuery("");
                  }
                }}
                autoFocus={editingPlace}
                placeholder="장소명·지역 (예: 성산일출봉)"
              />
            )}
          </div>

          {/* 분류 — 여행 폼과 동일한 풀. 단일 선택. */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">분류</Label>
            <TagInput
              selectedTags={category ? [category] : []}
              allTags={categories.map((c) => ({ id: c, name: c, color: colors[c] || "#6B7280" }))}
              onChange={(next) => {
                // TagInput 을 단일 선택으로 쓰기 — 가장 최근 선택값만 유지
                const picked = next.find((t) => t !== category);
                if (picked) setCategory(picked);
                else if (next.length === 0) setCategory("");
              }}
              onAddTag={addCategory}
              onDeleteTag={deleteCategory}
              onUpdateTagColor={updateCategoryColor}
              onRenameTag={updateCategoryName}
              builtinIds={BUILTIN_TRAVEL_CATEGORIES}
              orderKey="tag-order:travel-categories"
              placeholder="분류 선택"
            />
          </div>

          {/* 태그 — 캘린더·여행 폼과 공용 이벤트 태그 풀 */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">태그</Label>
            <TagInput
              selectedTags={selectedTags}
              allTags={allEventTags}
              onChange={setSelectedTags}
              onAddTag={addEventTag}
              onDeleteTag={deleteEventTag}
              onUpdateTagColor={updateEventTagColor}
              orderKey="tag-order:event-tags"
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
    </>
  );

  const title = task ? "일정 수정" : "새 일정";

  // 데스크탑: 중앙 모달
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>
          {renderForm()}
        </DialogContent>
      </Dialog>
    );
  }

  // 모바일: 하단 바텀시트 90dvh
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] overflow-y-auto overscroll-contain"
        style={{ height: "90dvh" }}
        showBackButton={false}
        showCloseButton={false}
        initialFocus={false}
      >
        <div className="mx-auto w-full max-w-xl flex flex-col">
          <SheetHeader className="pt-2 shrink-0">
            <div className="flex flex-col items-center">
              <div className="h-1.5 w-14 rounded-full bg-muted-foreground/40 mb-3" />
            </div>
            <SheetTitle className="text-base">{title}</SheetTitle>
          </SheetHeader>
          {renderForm()}
        </div>
      </SheetContent>
    </Sheet>
  );
}

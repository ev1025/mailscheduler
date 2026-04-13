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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import TagInput from "@/components/ui/tag-input";
import ColorPickerRow from "@/components/ui/color-picker-popover";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { TravelItem, TravelCategory, TravelTag, EventTag } from "@/types";

const CATEGORIES: TravelCategory[] = ["자연", "숙소", "식당", "놀거리", "데이트", "공연", "쇼핑", "기타"];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const DEFAULT_CATEGORY_COLORS: Record<TravelCategory, string> = {
  자연: "#22C55E",
  숙소: "#A855F7",
  식당: "#F59E0B",
  놀거리: "#3B82F6",
  데이트: "#EC4899",
  공연: "#8B5CF6",
  쇼핑: "#06B6D4",
  기타: "#6B7280",
};

const CATEGORY_COLOR_KEY = "travel-category-colors";

function loadCategoryColors(): Record<TravelCategory, string> {
  if (typeof window === "undefined") return DEFAULT_CATEGORY_COLORS;
  try {
    const raw = localStorage.getItem(CATEGORY_COLOR_KEY);
    if (!raw) return DEFAULT_CATEGORY_COLORS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CATEGORY_COLORS, ...parsed };
  } catch {
    return DEFAULT_CATEGORY_COLORS;
  }
}


interface TravelFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: TravelItem | null;
  tags: TravelTag[];
  eventTags?: EventTag[];
  onAddTag?: (name: string, color: string) => Promise<{ error: unknown }>;
  onDeleteTag?: (id: string) => Promise<{ error: unknown }>;
  onUpdateTagColor?: (id: string, color: string) => Promise<{ error: unknown }>;
  onAddEventTag?: (name: string, color: string) => Promise<{ error: unknown }>;
  onDeleteEventTag?: (id: string) => Promise<{ error: unknown }>;
  onUpdateEventTagColor?: (id: string, color: string) => Promise<{ error: unknown }>;
  onNavigateToMonth?: (year: number, month: number) => void;
  onRemoveVisitedDate?: (itemId: string, date: string) => Promise<void>;
  onSave: (data: Omit<TravelItem, "id" | "created_at" | "updated_at">) => Promise<{ error: unknown }>;
}

export default function TravelForm({
  open, onOpenChange, item, tags, eventTags = [], onAddTag, onDeleteTag, onUpdateTagColor, onAddEventTag, onDeleteEventTag, onUpdateEventTagColor, onNavigateToMonth, onRemoveVisitedDate, onSave,
}: TravelFormProps) {
  const [categoryColors, setCategoryColors] = useState<Record<TravelCategory, string>>(DEFAULT_CATEGORY_COLORS);

  useEffect(() => {
    setCategoryColors(loadCategoryColors());
  }, []);

  const updateCategoryColor = (cat: TravelCategory, col: string) => {
    const next = { ...categoryColors, [cat]: col };
    setCategoryColors(next);
    try {
      localStorage.setItem(CATEGORY_COLOR_KEY, JSON.stringify(next));
    } catch {}
  };

  const [title, setTitle] = useState("");
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLORS["놀거리"]);
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState<TravelCategory>("놀거리");
  const [month, setMonth] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [visited, setVisited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mood, setMood] = useState<string>("");
  const [priceTier, setPriceTier] = useState<number | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [coupleNotes, setCoupleNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (item) {
      setTitle(item.title);
      setColor(item.color || categoryColors[item.category] || "#3B82F6");
      setRegion(item.region || "");
      setCategory(item.category);
      setMonth(item.month ?? null);
      setSelectedTags(item.tag ? item.tag.split(",") : []);
      setNotes(item.notes || "");
      setVisited(item.visited);
      setMood(item.mood || "");
      setPriceTier(item.price_tier ?? null);
      setRating(item.rating ?? null);
      setCoupleNotes(item.couple_notes || "");
    } else {
      setTitle("");
      setColor(categoryColors["놀거리"]);
      setRegion("");
      setCategory("놀거리");
      setMonth(null);
      setSelectedTags([]);
      setNotes("");
      setVisited(false);
      setMood("");
      setPriceTier(null);
      setRating(null);
      setCoupleNotes("");
    }
  }, [item, open]);

  // 일정 태그 / 여행 태그 분리
  const eventTagNames = new Set(eventTags.map((t) => t.name));
  const selectedEventTags = selectedTags.filter((t) => eventTagNames.has(t));
  const selectedTravelTags = selectedTags.filter((t) => !eventTagNames.has(t));

  const setEventTagSelection = (newEventTags: string[]) => {
    setSelectedTags([...newEventTags, ...selectedTravelTags]);
  };
  const setTravelTagSelection = (newTravelTags: string[]) => {
    setSelectedTags([...selectedEventTags, ...newTravelTags]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await onSave({
      title: title.trim(),
      in_season: false,
      region: region.trim() || null,
      category,
      visited,
      tag: selectedTags.length > 0 ? selectedTags.join(",") : null,
      notes: notes.trim() || null,
      month,
      color,
      visited_dates: visited ? (item?.visited_dates ?? null) : null,
      mood: (mood || null) as TravelItem["mood"],
      price_tier: priceTier,
      rating: rating,
      couple_notes: coupleNotes.trim() || null,
      cover_image_url: item?.cover_image_url ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error("저장 실패 — travel_items 테이블을 확인하세요.");
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "여행 항목 수정" : "여행 항목 추가"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 제목 */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 (예: 진해 군항제)"
            className="h-9"
            autoFocus
          />

          {/* 색상 */}
          <div className="flex items-center gap-2">
            <Label className="w-12 shrink-0 text-xs text-muted-foreground">색상</Label>
            <ColorPickerRow color={color} onChange={setColor} />
          </div>

          {/* 시기 / 지역 / 가봄 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">시기</Label>
              <Select
                value={month != null ? String(month) : "none"}
                onValueChange={(v) => setMonth(!v || v === "none" ? null : parseInt(v))}
              >
                <SelectTrigger className="h-8 w-full">
                  {month != null ? `${month}월` : <span className="text-muted-foreground">-</span>}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={String(m)}>{m}월</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">지역</Label>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="지역"
                className="h-8 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground invisible">.</Label>
              <div className="h-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={visited}
                  onClick={() => setVisited((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    visited ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      visited ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-xs text-muted-foreground">{visited ? "가봄" : "안 가봄"}</span>
              </div>
            </div>
          </div>

          {/* 분류 태그 / 일정 태그 / 여행 태그 (3열) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">분류 태그</Label>
              <TagInput
                selectedTags={[category]}
                allTags={CATEGORIES.map((c) => ({ id: c, name: c, color: categoryColors[c] || "#6B7280" }))}
                onChange={(next) => {
                  const picked = next.find((t) => t !== category);
                  if (picked) setCategory(picked as TravelCategory);
                }}
                onUpdateTagColor={async (id, col) => {
                  updateCategoryColor(id as TravelCategory, col);
                  return { error: null };
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">일정 태그</Label>
              <TagInput
                selectedTags={selectedEventTags}
                allTags={eventTags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
                onChange={setEventTagSelection}
                onAddTag={onAddEventTag}
                onDeleteTag={onDeleteEventTag}
                onUpdateTagColor={onUpdateEventTagColor}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">여행 태그</Label>
              <TagInput
                selectedTags={selectedTravelTags}
                allTags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
                onChange={setTravelTagSelection}
                onAddTag={onAddTag}
                onDeleteTag={onDeleteTag}
                onUpdateTagColor={onUpdateTagColor}
              />
            </div>
          </div>

          {/* 여행 내용 */}
          {/* 데이트/여행 상세: 분위기 / 가격대 / 별점 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">분위기</Label>
              <div className="flex flex-wrap gap-1">
                {(["로맨틱", "캐주얼", "활동적", "조용"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(mood === m ? "" : m)}
                    className={`rounded-full border px-1.5 py-0.5 text-[10px] transition-colors ${
                      mood === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">가격대</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPriceTier(priceTier === n ? null : n)}
                    className={`flex-1 rounded-md border py-1 text-xs transition-colors ${
                      priceTier === n
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {"₩".repeat(n)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">별점</Label>
              <div className="flex h-8 items-center">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? null : n)}
                    className="text-lg leading-none transition-colors"
                    style={{
                      color:
                        rating && n <= rating ? "#F59E0B" : "#CBD5E1",
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">여행 내용</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="여행 관련 메모" rows={3} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">함께한 메모 💕</Label>
            <Textarea
              value={coupleNotes}
              onChange={(e) => setCoupleNotes(e.target.value)}
              placeholder="함께 간 날 느낀 점, 에피소드 등"
              rows={2}
            />
          </div>

          {/* 가본 날 (캘린더 추가 이력) */}
          {item && item.visited_dates && item.visited_dates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">가본 날</Label>
              <div className="flex flex-wrap gap-1.5">
                {item.visited_dates.map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  const label = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
                  return (
                    <div key={d} className="group/vd relative">
                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer"
                        onClick={() => {
                          if (onNavigateToMonth) {
                            onNavigateToMonth(dt.getFullYear(), dt.getMonth() + 1);
                            onOpenChange(false);
                          }
                        }}
                      >
                        {label}
                      </button>
                      {onRemoveVisitedDate && (
                        <button
                          type="button"
                          className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/vd:opacity-100 transition-opacity rounded-full bg-background border text-muted-foreground hover:text-destructive p-0.5"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await onRemoveVisitedDate(item.id, d);
                          }}
                          title="가본 날에서 제거"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button type="submit" disabled={!title.trim() || saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

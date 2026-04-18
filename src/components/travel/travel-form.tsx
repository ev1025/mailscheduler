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
import { useTravelCategories, BUILTIN_TRAVEL_CATEGORIES } from "@/hooks/use-travel-categories";
import type { TravelItem, TravelCategory, TravelTag, EventTag } from "@/types";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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
  onRenameEventTag?: (id: string, name: string) => Promise<{ error: unknown }>;
  onNavigateToMonth?: (year: number, month: number) => void;
  onRemoveVisitedDate?: (itemId: string, date: string) => Promise<void>;
  onSave: (data: Omit<TravelItem, "id" | "created_at" | "updated_at">) => Promise<{ error: unknown }>;
}

export default function TravelForm({
  open, onOpenChange, item, eventTags = [], onAddEventTag, onDeleteEventTag, onUpdateEventTagColor, onRenameEventTag, onNavigateToMonth, onRemoveVisitedDate, onSave,
}: TravelFormProps) {
  const { categories: midCategories, colors: categoryColors, addCategory, deleteCategory, updateCategoryColor, updateCategoryName } = useTravelCategories();

  const [title, setTitle] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [region, setRegion] = useState("");
  // 미선택 상태(빈 문자열) — 사용자가 분류를 직접 골라야 저장 가능
  const [category, setCategory] = useState<TravelCategory | "">("");
  const [month, setMonth] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [visited, setVisited] = useState(false);
  const [saving, setSaving] = useState(false);

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
    } else {
      setTitle("");
      setColor("#3B82F6");
      setRegion("");
      setCategory("");
      setMonth(null);
      setSelectedTags([]);
      setNotes("");
      setVisited(false);
    }
  }, [item, open]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !category) return;
    setSaving(true);
    const { error } = await onSave({
      title: title.trim(),
      in_season: false,
      region: region.trim() || null,
      category: category as TravelCategory,
      visited,
      tag: selectedTags.length > 0 ? selectedTags.join(",") : null,
      notes: notes.trim() || null,
      month,
      color,
      visited_dates: visited ? (item?.visited_dates ?? null) : null,
      mood: null,
      price_tier: null,
      rating: null,
      couple_notes: null,
      cover_image_url: null,
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" initialFocus={false}>
        <DialogHeader>
          <DialogTitle>{item ? "여행 항목 수정" : "여행 항목 추가"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 제목 */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 (예: 진해 군항제)"
            className="h-9 text-sm"
          />

          {/* 색상 */}
          <div className="flex items-center gap-2">
            <Label className="w-12 shrink-0 text-xs text-muted-foreground">색상</Label>
            <ColorPickerRow color={color} onChange={setColor} />
          </div>

          {/* 시기 / 지역 / 가봄 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">시기</Label>
              <Select
                value={month != null ? String(month) : "none"}
                onValueChange={(v) => setMonth(!v || v === "none" ? null : parseInt(v))}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  {month != null ? `${month}월` : <span className="text-muted-foreground">-</span>}
                </SelectTrigger>
                <SelectContent className="min-w-0">
                  <SelectItem value="none">없음</SelectItem>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={String(m)}>{m}월</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">지역</Label>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="지역"
                className="h-8 w-full text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground invisible">.</Label>
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

          {/* 분류 — 미선택 상태 허용, 저장 시 필수 */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">분류 *</Label>
            <TagInput
              selectedTags={category ? [category] : []}
              allTags={midCategories.map((c) => ({ id: c, name: c, color: categoryColors[c] || "#6B7280" }))}
              onChange={(next) => {
                // 기존 미선택 또는 현재 선택과 다른 값이 들어왔을 때만 교체
                const picked = next.find((t) => t !== category);
                if (picked) setCategory(picked as TravelCategory);
                else if (next.length === 0) setCategory("");
              }}
              onAddTag={addCategory}
              onDeleteTag={deleteCategory}
              onUpdateTagColor={updateCategoryColor}
              onRenameTag={updateCategoryName}
              builtinIds={BUILTIN_TRAVEL_CATEGORIES}
              placeholder="분류 선택"
            />
          </div>

          {/* 태그 */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">태그</Label>
            <TagInput
              selectedTags={selectedTags}
              allTags={eventTags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
              onChange={setSelectedTags}
              onAddTag={onAddEventTag}
              onDeleteTag={onDeleteEventTag}
              onUpdateTagColor={onUpdateEventTagColor}
              onRenameTag={onRenameEventTag}
              placeholder="태그"
            />
          </div>

          {/* 여행 내용 */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">여행 내용</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="여행 관련 메모" rows={4} className="text-xs" />
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
            <Button type="submit" disabled={!title.trim() || !category || saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

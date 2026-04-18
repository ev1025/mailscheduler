"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import ColorPickerPanel from "@/components/ui/color-picker";
import { Plus, X, Search, MoreHorizontal, ArrowLeft, Trash2 } from "lucide-react";

interface TagDef {
  id: string;
  name: string;
  color: string;
}

interface TagInputProps {
  selectedTags: string[];
  allTags: TagDef[];
  onChange: (tags: string[]) => void;
  onAddTag?: (name: string, color: string) => Promise<{ error: unknown }>;
  onDeleteTag?: (id: string) => Promise<{ error: unknown }>;
  onUpdateTagColor?: (id: string, color: string) => Promise<{ error: unknown }>;
  placeholder?: string;
}

const TAG_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
  "#F43F5E",
];

// 편집 뷰 프리셋 컬러 (기본 추천 동그라미)
const PRESET_COLORS = [
  "#6B7280", "#EF4444", "#F97316", "#F59E0B",
  "#EAB308", "#84CC16", "#22C55E", "#14B8A6",
  "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899",
];

function randomTagColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

export default function TagInput({
  selectedTags,
  allTags,
  onChange,
  onAddTag,
  onDeleteTag,
  onUpdateTagColor,
  placeholder = "검색",
}: TagInputProps) {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // half (50dvh) ↔ full (95dvh) 스냅 포인트
  const [snap, setSnap] = useState<"half" | "full">("half");

  // 뷰 전환: 목록 ↔ 개별 태그 편집
  const [view, setView] = useState<"list" | "edit">("list");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const editingTag = editingTagId ? allTags.find((t) => t.id === editingTagId) : null;

  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    if (open) {
      setSnap("half");
      setView("list");
      setShowColorPicker(false);
    } else {
      setNewTagName("");
      setEditingTagId(null);
    }
  }, [open]);

  const enterEdit = (t: TagDef) => {
    setEditingTagId(t.id);
    setEditName(t.name);
    setEditColor(t.color);
    setShowColorPicker(false);
    setView("edit");
  };

  const exitEdit = () => {
    setView("list");
    setEditingTagId(null);
    setShowColorPicker(false);
  };

  const saveEdit = async () => {
    if (!editingTag) { exitEdit(); return; }
    if (editColor && editColor !== editingTag.color && onUpdateTagColor) {
      await onUpdateTagColor(editingTag.id, editColor);
    }
    // 이름 변경은 현재 onUpdateTagColor 외 API가 없어서 이름만 바꾸는 건 생략
    // (색상만 변경 지원)
    exitEdit();
  };

  const deleteCurrentTag = async () => {
    if (!editingTag || !onDeleteTag) return;
    await onDeleteTag(editingTag.id);
    onChange(selectedTags.filter((n) => n !== editingTag.name));
    exitEdit();
  };

  const toggleTag = (name: string) => {
    if (selectedTags.includes(name)) {
      onChange(selectedTags.filter((t) => t !== name));
    } else {
      onChange([...selectedTags, name]);
    }
  };

  const handleAdd = async () => {
    if (!newTagName.trim() || !onAddTag) return;
    const { error } = await onAddTag(newTagName.trim(), randomTagColor());
    if (!error) {
      onChange([...selectedTags, newTagName.trim()]);
      setNewTagName("");
    }
  };

  const handleEnter = () => {
    if (!newTagName.trim()) return;
    const existing = allTags.find((t) => t.name === newTagName.trim());
    if (existing) {
      if (!selectedTags.includes(existing.name)) toggleTag(existing.name);
      setNewTagName("");
    } else {
      handleAdd();
    }
  };

  const filtered = allTags.filter(
    (t) => !newTagName.trim() || t.name.toLowerCase().includes(newTagName.trim().toLowerCase())
  );

  // ── 드래그: half ↔ full, 아래로 크게 끌면 close ──────────────
  const dragStartY = useRef<number | null>(null);
  const dragStartSnap = useRef<"half" | "full">("half");
  const onDragStart = (e: React.TouchEvent | React.PointerEvent) => {
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = y;
    dragStartSnap.current = snap;
  };
  const onDragEnd = (e: React.TouchEvent | React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const y =
      "changedTouches" in e
        ? e.changedTouches[0].clientY
        : e.clientY;
    const dy = y - dragStartY.current;
    dragStartY.current = null;
    const T = 60;
    if (dragStartSnap.current === "half") {
      if (dy < -T) setSnap("full");
      else if (dy > T) setOpen(false);
    } else {
      // full
      if (dy > T * 3) setOpen(false);
      else if (dy > T) setSnap("half");
    }
  };

  // 시트 바깥에서 탭/스와이프로도 닫을 수 있게 — onOpenChange가 이를 처리함

  return (
    <div className="flex flex-col gap-1.5">
      {/* 트리거 — 선택된 태그를 인라인으로 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center flex-wrap gap-1 min-h-8 w-full rounded-md border bg-transparent px-2 py-1 text-xs text-left hover:bg-accent/30 transition-colors"
      >
        {selectedTags.length === 0 ? (
          <span className="flex items-center gap-2 text-muted-foreground px-1">
            <Search className="h-3 w-3" />
            {placeholder}
          </span>
        ) : (
          selectedTags.map((name) => {
            const t = allTags.find((x) => x.name === name);
            const color = t?.color || "#6B7280";
            return (
              <Badge
                key={name}
                className="text-xs px-1.5 py-0"
                style={{ backgroundColor: color + "20", color, borderColor: color + "40" }}
              >
                {name}
              </Badge>
            );
          })
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] overflow-hidden transition-[height] duration-200 ease-out"
          style={{ height: snap === "full" ? "95dvh" : "50dvh" }}
          showBackButton={false}
          showCloseButton={false}
        >
          {view === "list" ? (
            <div className="flex flex-col h-full">
              {/* 드래그 영역 — 핸들 + 제목까지 모두 드래그 가능
                  (반만 올라와있을 때 핸들 아닌데 눌러도 끌 수 있도록) */}
              <div
                className="flex flex-col items-center pt-2 pb-2 cursor-grab active:cursor-grabbing touch-none shrink-0"
                onTouchStart={onDragStart}
                onTouchEnd={onDragEnd}
                onPointerDown={(e) => {
                  if (e.pointerType !== "touch") onDragStart(e);
                }}
                onPointerUp={(e) => {
                  if (e.pointerType !== "touch") onDragEnd(e);
                }}
              >
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30 mb-2" />
                <div className="text-sm font-medium text-center">
                  {placeholder === "검색" ? "태그" : placeholder}
                </div>
              </div>

              <div className="flex flex-col gap-3 px-4 pb-3 flex-1 min-h-0">
                {/* 입력창 — 선택된 칩 인라인 + 텍스트 input.
                    autoFocus 없음. 입력 영역 탭해야 키보드 뜸 */}
                <div
                  className="rounded-md border px-2 py-1.5 flex flex-wrap items-center gap-1 min-h-[40px] cursor-text"
                  onClick={() => inputRef.current?.focus()}
                >
                  {selectedTags.map((name) => {
                    const t = allTags.find((x) => x.name === name);
                    const color = t?.color || "#6B7280";
                    return (
                      <Badge
                        key={name}
                        className="text-xs pl-1.5 pr-1 py-0 gap-0"
                        style={{ backgroundColor: color + "20", color, borderColor: color + "40" }}
                      >
                        {name}
                        <span
                          role="button"
                          tabIndex={-1}
                          onClick={(e) => { e.stopPropagation(); toggleTag(name); }}
                          className="ml-0.5 opacity-60 hover:opacity-100 cursor-pointer"
                          aria-label={`${name} 제거`}
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </Badge>
                    );
                  })}
                  <input
                    ref={inputRef}
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder={selectedTags.length === 0 ? placeholder : ""}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    name="tag-search"
                    className="flex-1 min-w-[60px] bg-transparent outline-none text-sm h-6"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleEnter();
                      }
                      if (e.key === "Backspace" && !newTagName && selectedTags.length > 0) {
                        e.preventDefault();
                        onChange(selectedTags.slice(0, -1));
                      }
                    }}
                  />
                </div>

                <div className="text-xs text-muted-foreground">옵션 선택 또는 생성</div>

                {/* 리스트 — 각 행에 '...' 버튼만 */}
                <div className="flex flex-col overflow-y-auto flex-1 -mx-1 px-1">
                  {filtered.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between px-2 py-2 hover:bg-accent rounded cursor-pointer"
                      onClick={() => { toggleTag(t.name); setNewTagName(""); }}
                    >
                      <Badge
                        className="text-xs px-1.5 py-0"
                        style={{ backgroundColor: t.color + "20", color: t.color, borderColor: t.color + "40" }}
                      >
                        {t.name}
                      </Badge>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); enterEdit(t); }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        aria-label={`${t.name} 편집`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {newTagName.trim() && !allTags.some((t) => t.name === newTagName.trim()) && onAddTag && (
                    <div
                      className="flex items-center gap-2 px-2 py-2 hover:bg-accent rounded cursor-pointer text-sm text-muted-foreground"
                      onClick={handleAdd}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>&quot;{newTagName.trim()}&quot; 추가</span>
                    </div>
                  )}
                  {filtered.length === 0 && !newTagName.trim() && allTags.length === 0 && (
                    <div className="px-2.5 py-6 text-xs text-muted-foreground text-center">
                      태그를 입력해서 추가하세요
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ───────── 편집 뷰 (같은 시트에서 내용만 교체) ───────── */
            <div className="flex flex-col h-full">
              {/* 드래그 바 + 헤더(뒤로 · 미리보기 · 완료) */}
              <div
                className="flex flex-col items-center pt-2 shrink-0"
                onTouchStart={onDragStart}
                onTouchEnd={onDragEnd}
                onPointerDown={(e) => { if (e.pointerType !== "touch") onDragStart(e); }}
                onPointerUp={(e) => { if (e.pointerType !== "touch") onDragEnd(e); }}
              >
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30 mb-2" />
              </div>
              <div className="flex items-center justify-between px-3 pb-2 shrink-0">
                <button
                  type="button"
                  onClick={exitEdit}
                  className="flex items-center gap-1 h-8 px-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
                  aria-label="목록으로"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                {editingTag && (
                  <Badge
                    className="text-xs px-2 py-0.5"
                    style={{ backgroundColor: editColor + "20", color: editColor, borderColor: editColor + "40" }}
                  >
                    {editName || editingTag.name}
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={saveEdit}
                  className="h-8 px-2 rounded text-sm text-primary hover:bg-accent"
                >
                  완료
                </button>
              </div>

              <div className="flex flex-col gap-3 px-4 pb-3 flex-1 min-h-0 overflow-y-auto">
                {/* 이름 변경 — 현재 API 한계로 UI만 노출하되 저장은 색상만.
                    후에 onRenameTag 콜백 추가 시 자연스럽게 확장 */}
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="태그 이름"
                  className="rounded-md border px-3 h-9 text-sm outline-none focus:border-primary"
                />

                {/* 삭제 */}
                <button
                  type="button"
                  onClick={deleteCurrentTag}
                  className="flex items-center gap-2 rounded-md border px-3 h-9 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>삭제</span>
                </button>

                {/* 색상 — 프리셋 동그라미 + 커스텀 컬러피커 */}
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-muted-foreground">색</div>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={`h-7 w-7 rounded-full transition-all ${
                          editColor.toLowerCase() === c.toLowerCase()
                            ? "ring-2 ring-offset-2 ring-primary scale-110"
                            : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={c}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowColorPicker((s) => !s)}
                      className={`h-7 w-7 rounded-full transition-all ${
                        showColorPicker ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"
                      }`}
                      style={{
                        background: PRESET_COLORS.includes(editColor)
                          ? "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)"
                          : editColor,
                      }}
                      aria-label="커스텀 색상"
                    />
                  </div>
                  {showColorPicker && (
                    <div className="rounded-md border p-3 mt-1">
                      <ColorPickerPanel
                        color={editColor}
                        onPreview={setEditColor}
                        onConfirm={(c) => { setEditColor(c); setShowColorPicker(false); }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="px-4 pt-2 shrink-0">
                <Button type="button" onClick={saveEdit} className="w-full h-9">
                  저장
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

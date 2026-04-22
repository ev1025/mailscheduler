"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DraggableSheet from "@/components/ui/draggable-sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ColorPickerPanel from "@/components/ui/color-picker";
import { useMediaQuery } from "@/lib/use-media-query";
import { useExclusiveBottomSheet } from "@/lib/dialog-stack";
import { Plus, X, Search, MoreHorizontal, ArrowLeft, Trash2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
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
  onRenameTag?: (id: string, name: string) => Promise<{ error: unknown }>;
  /** 삭제·이름변경 불가 기본 태그 id 목록 (편집 패널에서 해당 버튼 숨김) */
  builtinIds?: string[];
  /** 순서 저장 localStorage 키 (예: "tag-order:event-tags"). 지정 시 꾹눌러서 드래그로 재정렬 가능 */
  orderKey?: string;
  placeholder?: string;
}

function SortableTagRow({
  tag,
  isInputFocused,
  onSelect,
  onEdit,
}: {
  tag: TagDef;
  isInputFocused: () => boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tag.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center justify-between px-2 py-2 hover:bg-accent rounded cursor-grab active:cursor-grabbing"
      onMouseDown={(e) => { if (isInputFocused()) e.preventDefault(); }}
      onClick={onSelect}
    >
      <Badge
        className="text-xs px-1.5 py-0"
        style={{ backgroundColor: tag.color + "20", color: tag.color, borderColor: tag.color + "40" }}
      >
        {tag.name}
      </Badge>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50"
        aria-label={`${tag.name} 편집`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

function loadTagOrder(key?: string): string[] {
  if (!key || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTagOrder(key: string, ids: string[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch {}
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
  onRenameTag,
  builtinIds,
  orderKey,
  placeholder = "검색",
}: TagInputProps) {
  const isBuiltin = (id: string) => !!builtinIds?.includes(id);

  // ── 꾹누르고 드래그해서 태그 순서 변경 ─────────────────────
  const [orderVersion, setOrderVersion] = useState(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 400, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 5 } })
  );
  // 저장된 순서 + 새로 추가된 태그(순서에 없는 것)를 뒤에 붙여 표시
  const sortedTags = useMemo(() => {
    if (!orderKey) return allTags;
    const savedIds = loadTagOrder(orderKey);
    if (savedIds.length === 0) return allTags;
    const byId = new Map(allTags.map((t) => [t.id, t]));
    const sorted: TagDef[] = [];
    for (const id of savedIds) {
      const t = byId.get(id);
      if (t) { sorted.push(t); byId.delete(id); }
    }
    sorted.push(...Array.from(byId.values()));
    return sorted;
    // orderVersion으로 순서 변경 시 재계산 유도
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTags, orderKey, orderVersion]);

  const handleDragEnd = (e: DragEndEvent) => {
    if (!orderKey || !e.over || e.active.id === e.over.id) return;
    const oldIdx = sortedTags.findIndex((t) => t.id === e.active.id);
    const newIdx = sortedTags.findIndex((t) => t.id === e.over!.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(sortedTags, oldIdx, newIdx);
    saveTagOrder(orderKey, reordered.map((t) => t.id));
    setOrderVersion((v) => v + 1);
  };
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // 데스크탑(md 이상)에서는 바텀시트 대신 트리거 아래 Popover 로 렌더
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // 모바일 바텀시트 single-instance — 분류/태그 동시에 두 개 열리지 않도록
  // (새로 열리는 시트가 이전 활성 시트를 자동으로 닫음)
  useExclusiveBottomSheet(!isDesktop && open, () => setOpen(false));

  // 뷰 전환: 목록 ↔ 개별 태그 편집
  const [view, setView] = useState<"list" | "edit">("list");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const editingTag = editingTagId ? allTags.find((t) => t.id === editingTagId) : null;

  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    if (open) {
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
    // 색상 변경
    if (editColor && editColor !== editingTag.color && onUpdateTagColor) {
      await onUpdateTagColor(editingTag.id, editColor);
    }
    // 이름 변경 (공백/동일명은 스킵)
    const trimmedName = editName.trim();
    if (
      trimmedName &&
      trimmedName !== editingTag.name &&
      onRenameTag
    ) {
      const { error } = await onRenameTag(editingTag.id, trimmedName);
      if (!error) {
        // 선택된 태그 목록에 구 이름이 있으면 새 이름으로 치환
        if (selectedTags.includes(editingTag.name)) {
          onChange(
            selectedTags.map((n) => (n === editingTag.name ? trimmedName : n))
          );
        }
      }
    }
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

  const filtered = sortedTags.filter(
    (t) => !newTagName.trim() || t.name.toLowerCase().includes(newTagName.trim().toLowerCase())
  );
  // 검색 중일 때는 드래그 순서 변경 비활성화 (의미가 없고 혼란 방지)
  const dragEnabled = !!orderKey && !newTagName.trim();

  // 트리거 내부에 들어갈 컨텐츠 (모바일 button / 데스크탑 PopoverTrigger 공통)
  const triggerContent =
    selectedTags.length === 0 ? (
      <span className="flex items-center gap-2 text-muted-foreground px-1">
        <Search className="h-3 w-3" />
        {placeholder}
      </span>
    ) : (
      <>
        {selectedTags.map((name) => {
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
        })}
      </>
    );

  const triggerClass =
    "flex items-center flex-wrap gap-1 min-h-8 w-full rounded-md border bg-transparent px-2 py-1 text-xs text-left hover:bg-accent/30 transition-colors";

  return (
    <div className="flex flex-col gap-1.5">
      {isDesktop ? (
        /* ── 데스크탑: 트리거 자체가 실제 input (콤보박스) — 드롭다운 내부는 리스트만 ── */
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            // 트리거가 input + badges 를 포함해야 해서 native button 으로 감쌀 수
            // 없음 (button 안에 input 불가). nativeButton=false 로 비버튼 요소 허용.
            nativeButton={false}
            render={<div role="combobox" aria-haspopup="listbox" aria-expanded={open} tabIndex={0} />}
            className={`${triggerClass} cursor-text`}
            onClick={() => {
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            {selectedTags.length === 0 && (
              <Search className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
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
              onChange={(e) => { setNewTagName(e.target.value); if (!open) setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleEnter();
                }
                if (e.key === "Backspace" && !newTagName && selectedTags.length > 0) {
                  e.preventDefault();
                  onChange(selectedTags.slice(0, -1));
                }
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder={selectedTags.length === 0 ? placeholder : ""}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name="tag-search"
              className="flex-1 min-w-[60px] bg-transparent outline-none text-xs h-5"
              onClick={(e) => e.stopPropagation()}
            />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="bottom"
            sideOffset={2}
            collisionAvoidance={{ side: "none", align: "none" }}
            // 트리거(input) 폭과 동일하게 — Base UI Popover 가 positioner 에
            // --anchor-width 변수를 세팅하므로 이를 그대로 사용
            className="w-[var(--anchor-width)] min-w-[240px] p-0 max-h-[60dvh] overflow-hidden"
          >
            {renderBody()}
          </PopoverContent>
        </Popover>
      ) : (
        /* ── 모바일: DraggableSheet (half 50dvh ↔ full 90dvh) ── */
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={triggerClass}
          >
            {triggerContent}
          </button>
          <DraggableSheet
            open={open}
            onOpenChange={setOpen}
            snapPoints={[0.5, 0.9]}
            defaultSnapIndex={0}
            scrollable={false}
            title={
              view === "list"
                ? placeholder === "검색"
                  ? "태그"
                  : placeholder.replace(/\s*\*\s*$/, "")
                : undefined
            }
          >
            {renderBody()}
          </DraggableSheet>
        </>
      )}
    </div>
  );

  // 태그 목록 / 편집 UI — Sheet·Popover 공통 본문.
  // 드래그 핸들·큰 제목은 모바일 바텀시트에서만 의미 있으므로 데스크탑에서는 생략.
  function renderBody() {
    return (
      <>
          {view === "list" ? (
            <div
              // 모바일: flex-1 min-h-0 로 DraggableSheet 안에서 남은 공간 채움.
              // 데스크탑: 내용 크기에 맞춤(Popover).
              className={`flex flex-col min-h-0 ${isDesktop ? "" : "flex-1"}`}
            >
              <div className={`flex flex-col gap-2 px-3 pb-3 flex-1 min-h-0 ${isDesktop ? "pt-3" : "pt-1"}`}>
                {/* 입력창 — 모바일 전용. 데스크탑은 트리거가 input 이므로 여기선 생략 */}
                {!isDesktop && (
                  <div
                    className="rounded-md border px-2 py-1.5 flex flex-wrap items-center gap-1 min-h-[40px]"
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
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
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
                )}

                {!isDesktop && (
                  <div className="text-xs text-muted-foreground">옵션 선택 또는 생성</div>
                )}

                {/* 리스트 — 꾹누르고 드래그로 순서 변경 (400ms delay).
                    onMouseDown preventDefault로 input 포커스 유지 → 키보드 깜박임 방지 */}
                <div className="flex flex-col overflow-y-auto overscroll-contain flex-1 -mx-1 px-1" data-sheet-scroll>
                  {dragEnabled ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={filtered.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                        {filtered.map((t) => (
                          <SortableTagRow
                            key={t.id}
                            tag={t}
                            isInputFocused={() => document.activeElement === inputRef.current}
                            onSelect={() => { toggleTag(t.name); setNewTagName(""); }}
                            onEdit={() => enterEdit(t)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  ) : (
                    filtered.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-2 py-2 hover:bg-accent rounded cursor-pointer"
                        onMouseDown={(e) => { if (document.activeElement === inputRef.current) e.preventDefault(); }}
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
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => { e.stopPropagation(); enterEdit(t); }}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50"
                          aria-label={`${t.name} 편집`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                  {newTagName.trim() && !allTags.some((t) => t.name === newTagName.trim()) && onAddTag && (
                    <div
                      className="flex items-center gap-2 px-2 py-2 hover:bg-accent rounded cursor-pointer text-sm text-muted-foreground"
                      onMouseDown={(e) => { if (document.activeElement === inputRef.current) e.preventDefault(); }}
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
            <div className={`flex flex-col min-h-0 ${isDesktop ? "" : "flex-1"}`}>
              <div className="flex items-center justify-between px-3 pt-1 pb-2 shrink-0">
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

              <div className="flex flex-col gap-3 px-4 pb-3 flex-1 min-h-0 overflow-y-auto overscroll-contain" data-sheet-scroll>
                {/* 이름 변경 — 현재 API 한계로 UI만 노출하되 저장은 색상만.
                    후에 onRenameTag 콜백 추가 시 자연스럽게 확장 */}
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="태그 이름"
                  className="rounded-md border px-3 h-9 text-sm outline-none focus:border-primary"
                />

                {/* 삭제 — 기본(builtin) 태그는 삭제 불가이므로 버튼 자체 숨김 */}
                {editingTag && !isBuiltin(editingTag.id) && (
                  <button
                    type="button"
                    onClick={deleteCurrentTag}
                    className="flex items-center gap-2 rounded-md border px-3 h-9 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>삭제</span>
                  </button>
                )}

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
                        showColorPicker || !PRESET_COLORS.includes(editColor)
                          ? "ring-2 ring-offset-2 ring-primary scale-110"
                          : "hover:scale-110"
                      }`}
                      // 컬러피커 버튼 — 현재 색이 무엇이든 항상 무지개(conic gradient)로
                      // 표시하여 "색상 선택" 역할을 명확히 드러냄.
                      // 커스텀 색이 선택되어 있으면 ring-2로 활성 상태만 표시.
                      style={{
                        background:
                          "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                      }}
                      aria-label="커스텀 색상"
                      title="컬러피커"
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
      </>
    );
  }
}

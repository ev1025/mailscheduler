"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ColorPickerPanel from "@/components/ui/color-picker";
import { Plus, X, Search } from "lucide-react";

function TagColorSwatch({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(color);
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setPreview(color); }}>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="h-3 w-3 rounded-sm shrink-0 cursor-pointer"
        style={{ backgroundColor: open ? preview : color }}
      />
      <PopoverContent
        className="w-[220px] p-3"
        align="start"
        side="bottom"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ColorPickerPanel
          color={color}
          onPreview={setPreview}
          onConfirm={(c) => { onChange(c); setOpen(false); }}
        />
      </PopoverContent>
    </Popover>
  );
}

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

  // ── 드래그 핸들: 아래로 끌면 닫힘 ─────────────────
  const dragStartY = useRef<number | null>(null);
  const dragContentRef = useRef<HTMLDivElement | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const onDragStart = (e: React.TouchEvent | React.PointerEvent) => {
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = y;
  };
  const onDragMove = (e: React.TouchEvent | React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    const dy = y - dragStartY.current;
    if (dy > 0) setDragOffset(dy);
  };
  const onDragEnd = () => {
    if (dragOffset > 80) {
      setOpen(false);
    }
    dragStartY.current = null;
    setDragOffset(0);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* 트리거 — 선택된 태그를 인라인으로 표시, 없으면 placeholder */}
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

      {/* 바텀시트 */}
      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setNewTagName(""); setDragOffset(0); } }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] h-[50dvh] overflow-hidden"
          showBackButton={false}
          showCloseButton={false}
        >
          <div
            ref={dragContentRef}
            className="flex flex-col h-full"
            style={{
              transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
              transition: dragOffset === 0 ? "transform 200ms ease-out" : "none",
            }}
          >
            {/* 가운데 드래그 핸들 바 (X 버튼 대체) */}
            <div
              className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
              onTouchStart={onDragStart}
              onTouchMove={onDragMove}
              onTouchEnd={onDragEnd}
              onPointerDown={onDragStart}
              onPointerMove={(e) => {
                if (dragStartY.current !== null && e.pointerType === "mouse" && e.buttons === 1) {
                  onDragMove(e);
                }
              }}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            >
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            <SheetHeader className="py-1">
              <SheetTitle className="text-sm text-center">{placeholder === "검색" ? "태그" : placeholder}</SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-3 px-4 pb-3 flex-1 min-h-0">
              {/* 입력창 — 선택된 태그들이 인라인으로, 그 옆에 텍스트 입력
                  autoFocus 없음 → 처음에는 키보드 안 뜸.
                  입력 영역을 탭하면 그때 키보드 올라오며 interactive-widget=resizes-content
                  설정 덕에 시트가 키보드 위로 자동 이동 */}
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
                      className="text-xs px-1.5 py-0 group/tag pr-1"
                      style={{ backgroundColor: color + "20", color, borderColor: color + "40" }}
                    >
                      {name}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleTag(name); }}
                        className="ml-1 opacity-60 hover:opacity-100"
                        aria-label={`${name} 제거`}
                      >
                        <X className="h-3 w-3" />
                      </button>
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
                      // 백스페이스로 마지막 태그 제거
                      e.preventDefault();
                      onChange(selectedTags.slice(0, -1));
                    }
                  }}
                />
              </div>

              {/* 옵션 라벨 */}
              <div className="text-xs text-muted-foreground">옵션 선택 또는 생성</div>

              {/* 태그 리스트 (스크롤) */}
              <div className="flex flex-col overflow-y-auto flex-1 -mx-1 px-1">
                {filtered.map((t) => {
                  const isSelected = selectedTags.includes(t.name);
                  return (
                    <div
                      key={t.id}
                      className="group/item flex items-center justify-between px-2 py-2 hover:bg-accent rounded text-sm whitespace-nowrap cursor-pointer"
                      onClick={() => { toggleTag(t.name); setNewTagName(""); }}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge
                          className="text-xs px-1.5 py-0 shrink-0"
                          style={{ backgroundColor: t.color + "20", color: t.color, borderColor: t.color + "40" }}
                        >
                          {t.name}
                        </Badge>
                        {onUpdateTagColor && (
                          <TagColorSwatch
                            color={t.color}
                            onChange={(c) => { onUpdateTagColor(t.id, c); }}
                          />
                        )}
                        {isSelected && <span className="text-primary text-xs ml-auto">✓</span>}
                      </div>
                      {onDeleteTag && (
                        <button
                          type="button"
                          className="text-muted-foreground/60 hover:text-destructive transition-colors p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTag(t.id);
                            onChange(selectedTags.filter((n) => n !== t.name));
                          }}
                          aria-label={`${t.name} 삭제`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {newTagName.trim() && !allTags.some((t) => t.name === newTagName.trim()) && onAddTag && (
                  <div
                    className="flex items-center gap-2 px-2 py-2 hover:bg-accent rounded cursor-pointer text-sm whitespace-nowrap text-muted-foreground"
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
        </SheetContent>
      </Sheet>
    </div>
  );
}

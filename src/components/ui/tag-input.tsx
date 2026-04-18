"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
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

// 태그 랜덤 색상 팔레트
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
  // 노션 스타일: 탭 → 아래서 올라오는 sheet 에서 검색/선택/추가
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");

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

  return (
    <div className="flex flex-col gap-1.5">
      {/* 트리거 — 현재 input 자리에 그대로 표시. 탭 시 sheet open */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center h-8 w-full rounded-md border bg-transparent px-3 text-xs text-muted-foreground text-left hover:bg-accent/30 transition-colors"
      >
        <Search className="h-3 w-3 mr-2 shrink-0" />
        <span>{placeholder}</span>
      </button>

      {/* 선택된 태그 배지 */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((name) => {
            const t = allTags.find((x) => x.name === name);
            const color = t?.color || "#6B7280";
            return (
              <Badge
                key={name}
                className="cursor-pointer text-xs px-1.5 py-0 group/tag pr-1"
                style={{ backgroundColor: color + "20", color, borderColor: color + "40" }}
                onClick={() => toggleTag(name)}
              >
                {name}
                <X className="h-3 w-3 ml-1 opacity-60 group-hover/tag:opacity-100" />
              </Badge>
            );
          })}
        </div>
      )}

      {/* 바텀시트 — 아래서 올라옴. 내부 input 포커스 시 키보드는
          viewport interactive-widget=resizes-content 설정으로
          자동으로 시트를 위로 밀어올림 */}
      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setNewTagName(""); }}>
        <SheetContent
          side="bottom"
          className="max-h-[80vh] rounded-t-xl pb-[max(env(safe-area-inset-bottom),1rem)]"
          showBackButton={false}
          showCloseButton={true}
        >
          <SheetHeader className="pb-1">
            <SheetTitle className="text-sm">태그</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4 min-h-0">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name="tag-search"
              className="h-9 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleEnter();
                }
              }}
            />

            {/* 선택된 태그를 시트 상단에도 표시 (중복 피하기) */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1 border-b">
                {selectedTags.map((name) => {
                  const t = allTags.find((x) => x.name === name);
                  const color = t?.color || "#6B7280";
                  return (
                    <Badge
                      key={name}
                      className="cursor-pointer text-xs px-1.5 py-0 group/tag pr-1"
                      style={{ backgroundColor: color + "20", color, borderColor: color + "40" }}
                      onClick={() => toggleTag(name)}
                    >
                      {name}
                      <X className="h-3 w-3 ml-1 opacity-60 group-hover/tag:opacity-100" />
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* 태그 리스트 (시트 내 스크롤) */}
            <div className="flex flex-col overflow-y-auto max-h-[50vh]">
              {filtered.map((t) => {
                const isSelected = selectedTags.includes(t.name);
                return (
                  <div
                    key={t.id}
                    className="group/item flex items-center justify-between px-2.5 py-2 hover:bg-accent rounded text-sm whitespace-nowrap cursor-pointer"
                    onClick={() => { toggleTag(t.name); setNewTagName(""); }}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {onUpdateTagColor ? (
                        <TagColorSwatch
                          color={t.color}
                          onChange={(c) => { onUpdateTagColor(t.id, c); }}
                        />
                      ) : (
                        <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: t.color }} />
                      )}
                      <span className={isSelected ? "font-medium" : ""}>{t.name}</span>
                      {isSelected && <span className="text-primary">✓</span>}
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
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {newTagName.trim() && !allTags.some((t) => t.name === newTagName.trim()) && onAddTag && (
                <div
                  className="flex items-center gap-2 px-2.5 py-2 hover:bg-accent rounded cursor-pointer text-sm whitespace-nowrap text-muted-foreground"
                  onClick={handleAdd}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>&quot;{newTagName.trim()}&quot; 추가</span>
                </div>
              )}
              {filtered.length === 0 && !newTagName.trim() && (
                <div className="px-2.5 py-6 text-xs text-muted-foreground text-center">
                  태그를 입력해서 추가하세요
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

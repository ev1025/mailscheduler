"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ColorPickerPanel from "@/components/ui/color-picker";
import { Plus, X } from "lucide-react";

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
  const [showDropdown, setShowDropdown] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  // 드롭다운이 열릴 때 입력 영역 + 드롭다운이 화면에 모두 보이도록 스크롤
  // (Dialog의 overflow-y-auto를 대상으로 동작)
  useEffect(() => {
    if (!showDropdown || !wrapperRef.current) return;
    const el = wrapperRef.current;
    const raf = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [showDropdown]);

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
      setShowDropdown(false);
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

  return (
    <div className="flex flex-col gap-1.5" ref={wrapperRef}>
      <div className="relative">
        <Input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          name="tag-search"
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleEnter();
            }
            if (e.key === "Escape") setShowDropdown(false);
          }}
        />
        {showDropdown && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-lg max-h-[140px] overflow-y-auto">
            {allTags
              .filter((t) => !newTagName.trim() || t.name.toLowerCase().includes(newTagName.trim().toLowerCase()))
              .map((t) => {
                const isSelected = selectedTags.includes(t.name);
                return (
                  <div
                    key={t.id}
                    className="group/item flex items-center justify-between px-2.5 py-1.5 hover:bg-accent text-xs whitespace-nowrap cursor-pointer"
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
                        className="text-muted-foreground/60 hover:text-destructive transition-colors p-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTag(t.id);
                          onChange(selectedTags.filter((n) => n !== t.name));
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            {newTagName.trim() && !allTags.some((t) => t.name === newTagName.trim()) && onAddTag && (
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent cursor-pointer text-xs whitespace-nowrap text-muted-foreground"
                onClick={handleAdd}
              >
                <Plus className="h-3 w-3" />
                <span>&quot;{newTagName.trim()}&quot; 추가</span>
              </div>
            )}
            {allTags.length === 0 && !newTagName.trim() && (
              <div className="px-2.5 py-3 text-xs text-muted-foreground text-center">
                태그를 입력해서 추가하세요
              </div>
            )}
          </div>
        )}
      </div>
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
    </div>
  );
}

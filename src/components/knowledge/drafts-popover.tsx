"use client";

import { Archive, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { KnowledgeDraft } from "@/hooks/use-knowledge-drafts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: KnowledgeDraft[];
  onLoad: (draft: KnowledgeDraft) => void;
  onDelete: (id: string) => void;
}

export default function DraftsPopover({
  open,
  onOpenChange,
  drafts,
  onLoad,
  onDelete,
}: Props) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
        title="임시저장 목록"
        aria-label="임시저장 목록"
      >
        <Archive className="h-[22px] w-[22px]" strokeWidth={1.6} />
        {drafts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
            {drafts.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 max-h-80 overflow-y-auto" align="end">
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-xs font-semibold">임시저장 ({drafts.length})</span>
        </div>
        {drafts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            임시저장된 글이 없습니다
          </p>
        ) : (
          <div className="flex flex-col">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="group flex items-start gap-2 border-b p-2 hover:bg-accent cursor-pointer"
                onClick={() => onLoad(d)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium line-clamp-1">{d.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(d.savedAt).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {d.source_id ? " · 수정본" : " · 신규"}
                    {d.auto ? " · 자동" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="p-0.5 text-muted-foreground/60 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(d.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

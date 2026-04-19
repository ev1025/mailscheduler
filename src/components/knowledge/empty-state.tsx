"use client";

import { FolderOpen, FilePlus, FolderPlus } from "lucide-react";

// 폴더/노트가 하나도 없을 때, 검색 결과가 없을 때 보여주는 안내 컴포넌트.

interface Props {
  variant: "no-folders" | "no-notes-in-folder" | "no-search-results";
  query?: string;
  onAddFolder?: () => void;
  onAddNote?: () => void;
}

export default function KnowledgeEmptyState({
  variant,
  query,
  onAddFolder,
  onAddNote,
}: Props) {
  if (variant === "no-search-results") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <p className="text-sm text-muted-foreground">
          &quot;{query}&quot; 와 일치하는 노트가 없습니다
        </p>
      </div>
    );
  }

  if (variant === "no-notes-in-folder") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <FolderOpen className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.4} />
        <p className="text-sm text-muted-foreground">이 폴더에 노트가 없습니다</p>
        {onAddNote && (
          <button
            type="button"
            onClick={onAddNote}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <FilePlus className="h-3.5 w-3.5" />첫 노트 만들기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <FolderOpen className="h-12 w-12 text-muted-foreground/40" strokeWidth={1.4} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">지식창고가 비어있어요</p>
        <p className="text-xs text-muted-foreground">
          폴더를 만들거나 바로 노트를 작성해보세요
        </p>
      </div>
      <div className="flex gap-2 pt-1">
        {onAddFolder && (
          <button
            type="button"
            onClick={onAddFolder}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs hover:bg-accent"
          >
            <FolderPlus className="h-3.5 w-3.5" />폴더
          </button>
        )}
        {onAddNote && (
          <button
            type="button"
            onClick={onAddNote}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90"
          >
            <FilePlus className="h-3.5 w-3.5" />노트
          </button>
        )}
      </div>
    </div>
  );
}

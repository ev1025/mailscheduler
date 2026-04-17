"use client";

import { ArrowLeft, Pin, Plus, FileText } from "lucide-react";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";

interface Props {
  folder: KnowledgeFolder | null;
  items: KnowledgeItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onBack: () => void;
  onAddItem: (folderId: string | null) => void;
}

export default function FolderNoteList({
  folder,
  items,
  selectedItemId,
  onSelectItem,
  onBack,
  onAddItem,
}: Props) {
  const folderId = folder?.id ?? null;
  const folderItems = items
    .filter((i) => (folderId ? i.folder_id === folderId : !i.folder_id))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b px-3 h-12 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-base">{folder?.icon || "📁"}</span>
        <h2 className="text-sm font-semibold truncate flex-1">{folder?.name || "미분류"}</h2>
      </div>

      {/* 노트 목록 */}
      <div className="flex-1 overflow-y-auto p-2">
        {folderItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <FileText className="h-10 w-10 opacity-20" />
            <p className="text-xs text-muted-foreground">아직 노트가 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {folderItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item.id)}
                className={`flex flex-col gap-0.5 rounded-lg border p-2.5 text-left transition-colors ${
                  selectedItemId === item.id ? "bg-accent border-primary/30" : "hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {item.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                  <span className="text-xs font-semibold line-clamp-1">{item.title || "(제목 없음)"}</span>
                </div>
                {item.tags && item.tags.length > 0 && (
                  <div className="flex gap-1">
                    {item.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {item.excerpt && (
                  <span className="text-[10px] text-muted-foreground line-clamp-1">{item.excerpt}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

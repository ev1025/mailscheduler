"use client";

import { ArrowLeft, Pin, FileText, Folder, ChevronRight } from "lucide-react";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";

interface Props {
  folder: KnowledgeFolder | null;
  folders: KnowledgeFolder[]; // 하위 폴더 표시용
  items: KnowledgeItem[];
  onSelectItem: (id: string) => void;
  onSelectFolder: (folderId: string) => void;
  onBack: () => void;
}

export default function FolderNoteList({
  folder,
  folders,
  items,
  onSelectItem,
  onSelectFolder,
  onBack,
}: Props) {
  const folderId = folder?.id ?? null;

  // 이 폴더의 직속 하위 폴더
  const subFolders = folders.filter((f) => f.parent_id === folderId);

  // 이 폴더의 노트
  const folderItems = items
    .filter((i) => (folderId ? i.folder_id === folderId : !i.folder_id))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b px-3 h-14 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent -ml-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-lg">{folder?.icon || "📁"}</span>
        <h2 className="text-base font-semibold truncate flex-1">{folder?.name || "미분류"}</h2>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-3">
        {subFolders.length === 0 && folderItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <FileText className="h-10 w-10 opacity-20" />
            <p className="text-xs text-muted-foreground">이 폴더는 비어있습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {/* 하위 폴더 */}
            {subFolders.map((sf) => (
              <button
                key={sf.id}
                type="button"
                onClick={() => onSelectFolder(sf.id)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors"
              >
                <span className="text-base">{sf.icon || "📁"}</span>
                <span className="flex-1 text-sm font-medium text-left">{sf.name}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}

            {/* 구분선 */}
            {subFolders.length > 0 && folderItems.length > 0 && (
              <div className="border-t my-1" />
            )}

            {/* 노트 */}
            {folderItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item.id)}
                className="flex items-center gap-2.5 rounded-lg border p-3 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {item.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                    <span className="text-sm font-semibold line-clamp-1">{item.title || "(제목 없음)"}</span>
                  </div>
                  {item.excerpt && (
                    <span className="text-xs text-muted-foreground line-clamp-1">{item.excerpt}</span>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex gap-1 mt-0.5">
                      {item.tags.slice(0, 3).map((t) => (
                        <span key={t} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { Search, Pin, ChevronRight, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";

interface DashboardProps {
  folders: KnowledgeFolder[];
  items: KnowledgeItem[];
  onSelectItem: (id: string) => void;
  onSelectFolder: (folderId: string) => void;
  onSearch: (q: string) => void;
  searchQuery: string;
  searchResults: KnowledgeItem[];
}

function NoteCard({ item, onClick }: { item: KnowledgeItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1 rounded-lg border p-3 text-left hover:bg-accent/50 transition-colors w-full"
    >
      <span className="text-sm font-semibold line-clamp-1">{item.title || "(제목 없음)"}</span>
      {item.excerpt && (
        <span className="text-xs text-muted-foreground line-clamp-2">{item.excerpt}</span>
      )}
      {item.tags && item.tags.length > 0 && (
        <div className="flex gap-1 mt-0.5">
          {item.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

export default function KnowledgeDashboard({
  folders,
  items,
  onSelectItem,
  onSelectFolder,
  onSearch,
  searchQuery,
  searchResults,
}: DashboardProps) {
  const pinnedItems = items.filter((i) => i.pinned);
  const rootFolders = folders.filter((f) => !f.parent_id);
  const unfiledItems = items.filter((i) => !i.folder_id && !i.pinned);

  // 폴더별 노트 수
  const folderCounts: Record<string, number> = {};
  for (const item of items) {
    if (item.folder_id) {
      folderCounts[item.folder_id] = (folderCounts[item.folder_id] || 0) + 1;
    }
  }
  for (const f of folders) {
    if (f.parent_id && folderCounts[f.id]) {
      folderCounts[f.parent_id] = (folderCounts[f.parent_id] || 0) + folderCounts[f.id];
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="노트 검색..."
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* 검색 모드 */}
      {searchQuery.trim() ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">{searchResults.length}개 결과</p>
          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">결과 없음</p>
          ) : (
            searchResults.map((item) => (
              <NoteCard key={item.id} item={item} onClick={() => onSelectItem(item.id)} />
            ))
          )}
        </div>
      ) : (
        <>
          {/* 고정 노트 */}
          {pinnedItems.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Pin className="h-3 w-3" /> 고정됨
              </h3>
              {pinnedItems.map((item) => (
                <NoteCard key={item.id} item={item} onClick={() => onSelectItem(item.id)} />
              ))}
            </section>
          )}

          {/* 폴더 */}
          {rootFolders.length > 0 && (
            <section className="flex flex-col">
              {rootFolders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectFolder(f.id)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors"
                >
                  <span className="text-base">{f.icon || "📁"}</span>
                  <span className="flex-1 text-sm font-medium text-left">{f.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </section>
          )}

          {/* 완전 비어있을 때 */}
          {pinnedItems.length === 0 && rootFolders.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <FileText className="h-12 w-12 opacity-20" />
              <p className="text-sm text-muted-foreground">
                폴더를 만들어 노트를 정리해보세요
              </p>
              <p className="text-xs text-muted-foreground">
                오른쪽 상단 + 버튼으로 폴더를 추가할 수 있어요
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

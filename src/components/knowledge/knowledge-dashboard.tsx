"use client";

import { useState, useRef, useCallback } from "react";
import { Search, Pin, ChevronRight, FileText, Trash2, CheckSquare, Square, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";

interface DashboardProps {
  folders: KnowledgeFolder[];
  items: KnowledgeItem[];
  onSelectItem: (id: string) => void;
  onSelectFolder: (folderId: string) => void;
  onSearch: (q: string) => void;
  searchQuery: string;
  searchResults: KnowledgeItem[];
  onDeleteItems?: (ids: string[]) => void;
  onDeleteFolders?: (ids: string[]) => void;
}

function NoteCard({
  item,
  onClick,
  selectMode,
  selected,
  onToggle,
  onLongPress,
}: {
  item: KnowledgeItem;
  onClick: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = () => {
    timerRef.current = setTimeout(onLongPress, 500);
  };
  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <button
      type="button"
      onClick={selectMode ? onToggle : onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors w-full ${
        selected ? "bg-primary/10 border-primary/30" : "hover:bg-accent/50"
      }`}
    >
      {selectMode && (
        selected
          ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-sm font-semibold line-clamp-1">{item.title || "(제목 없음)"}</span>
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
    </button>
  );
}

function FolderRow({
  folder,
  onClick,
  selectMode,
  selected,
  onToggle,
  onLongPress,
}: {
  folder: KnowledgeFolder;
  onClick: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = () => {
    timerRef.current = setTimeout(onLongPress, 500);
  };
  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <button
      type="button"
      onClick={selectMode ? onToggle : onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors w-full ${
        selected ? "bg-primary/10" : "hover:bg-accent/50"
      }`}
    >
      {selectMode && (
        selected
          ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <span className="text-base">{folder.icon || "📁"}</span>
      <span className="flex-1 text-sm font-medium text-left">{folder.name}</span>
      {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
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
  onDeleteItems,
  onDeleteFolders,
}: DashboardProps) {
  const pinnedItems = items.filter((i) => i.pinned);
  const rootFolders = folders.filter((f) => !f.parent_id);

  // 선택 모드
  const [selectMode, setSelectMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
  }, []);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedFolderIds(new Set());
    setSelectedItemIds(new Set());
  };

  const toggleFolder = (id: string) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedFolderIds(new Set(rootFolders.map((f) => f.id)));
    setSelectedItemIds(new Set(pinnedItems.map((i) => i.id)));
  };

  const totalSelected = selectedFolderIds.size + selectedItemIds.size;

  const handleDelete = () => {
    if (selectedItemIds.size > 0 && onDeleteItems) {
      onDeleteItems(Array.from(selectedItemIds));
    }
    if (selectedFolderIds.size > 0 && onDeleteFolders) {
      onDeleteFolders(Array.from(selectedFolderIds));
    }
    exitSelectMode();
  };

  return (
    <div className="flex flex-col h-full">
      {/* 선택 모드 툴바 */}
      {selectMode && (
        <div className="flex items-center gap-2 border-b px-3 h-12 shrink-0 bg-muted/30">
          <button type="button" onClick={exitSelectMode} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium flex-1">{totalSelected}개 선택</span>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={selectAll}>
            전체 선택
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 text-xs"
            disabled={totalSelected === 0}
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            삭제
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 p-4 overflow-y-auto flex-1">
        {/* 검색 */}
        {!selectMode && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="노트 검색..."
              className="pl-8 h-9 text-sm"
            />
          </div>
        )}

        {/* 검색 모드 */}
        {searchQuery.trim() && !selectMode ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">{searchResults.length}개 결과</p>
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">결과 없음</p>
            ) : (
              searchResults.map((item) => (
                <NoteCard
                  key={item.id}
                  item={item}
                  onClick={() => onSelectItem(item.id)}
                  selectMode={false}
                  selected={false}
                  onToggle={() => {}}
                  onLongPress={() => {}}
                />
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
                  <NoteCard
                    key={item.id}
                    item={item}
                    onClick={() => onSelectItem(item.id)}
                    selectMode={selectMode}
                    selected={selectedItemIds.has(item.id)}
                    onToggle={() => toggleItem(item.id)}
                    onLongPress={enterSelectMode}
                  />
                ))}
              </section>
            )}

            {/* 폴더 */}
            {rootFolders.length > 0 && (
              <section className="flex flex-col">
                {rootFolders.map((f) => (
                  <FolderRow
                    key={f.id}
                    folder={f}
                    onClick={() => onSelectFolder(f.id)}
                    selectMode={selectMode}
                    selected={selectedFolderIds.has(f.id)}
                    onToggle={() => toggleFolder(f.id)}
                    onLongPress={enterSelectMode}
                  />
                ))}
              </section>
            )}

            {/* 비어있을 때 */}
            {pinnedItems.length === 0 && rootFolders.length === 0 && !selectMode && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <FileText className="h-12 w-12 opacity-20" />
                <p className="text-sm text-muted-foreground">폴더를 만들어 노트를 정리해보세요</p>
                <p className="text-xs text-muted-foreground">오른쪽 상단 + 버튼으로 폴더를 추가할 수 있어요</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

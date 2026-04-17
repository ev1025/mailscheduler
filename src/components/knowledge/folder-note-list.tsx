"use client";

import { useState, useRef } from "react";
import { ArrowLeft, Pin, FileText, Folder, ChevronRight, Trash2, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";

interface Props {
  folder: KnowledgeFolder | null;
  folders: KnowledgeFolder[];
  items: KnowledgeItem[];
  onSelectItem: (id: string) => void;
  onSelectFolder: (folderId: string) => void;
  onBack: () => void;
  onDeleteItems?: (ids: string[]) => void;
  onDeleteFolders?: (ids: string[]) => void;
}

function LongPressItem({
  children,
  onClick,
  onLongPress,
  selectMode,
  selected,
  onToggle,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onLongPress: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTouchStart = () => { timerRef.current = setTimeout(onLongPress, 500); };
  const handleTouchEnd = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  return (
    <button
      type="button"
      onClick={selectMode ? onToggle : onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      className={`${className} ${selected ? "bg-primary/10 border-primary/30" : ""}`}
    >
      {selectMode && (
        selected
          ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      {children}
    </button>
  );
}

export default function FolderNoteList({
  folder,
  folders,
  items,
  onSelectItem,
  onSelectFolder,
  onBack,
  onDeleteItems,
  onDeleteFolders,
}: Props) {
  const folderId = folder?.id ?? null;
  const subFolders = folders.filter((f) => f.parent_id === folderId);
  const folderItems = items
    .filter((i) => (folderId ? i.folder_id === folderId : !i.folder_id))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const [selectMode, setSelectMode] = useState(false);
  const [selFolders, setSelFolders] = useState<Set<string>>(new Set());
  const [selItems, setSelItems] = useState<Set<string>>(new Set());

  const enterSelect = () => setSelectMode(true);
  const exitSelect = () => { setSelectMode(false); setSelFolders(new Set()); setSelItems(new Set()); };
  const toggleFolder = (id: string) => setSelFolders((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleItem = (id: string) => setSelItems((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const totalSel = selFolders.size + selItems.size;

  const handleDelete = () => {
    if (selItems.size > 0 && onDeleteItems) onDeleteItems(Array.from(selItems));
    if (selFolders.size > 0 && onDeleteFolders) onDeleteFolders(Array.from(selFolders));
    exitSelect();
  };

  const selectAll = () => {
    setSelFolders(new Set(subFolders.map((f) => f.id)));
    setSelItems(new Set(folderItems.map((i) => i.id)));
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b px-3 h-14 shrink-0">
        {selectMode ? (
          <>
            <button type="button" onClick={exitSelect} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent -ml-1">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium flex-1">{totalSel}개 선택</span>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={selectAll}>전체</Button>
            <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={totalSel === 0} onClick={handleDelete}>
              <Trash2 className="h-3 w-3 mr-1" />삭제
            </Button>
          </>
        ) : (
          <>
            <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent -ml-1">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-lg">{folder?.icon || "📁"}</span>
            <h2 className="text-base font-semibold truncate flex-1">{folder?.name || "미분류"}</h2>
          </>
        )}
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
            {subFolders.map((sf) => (
              <LongPressItem
                key={sf.id}
                onClick={() => onSelectFolder(sf.id)}
                onLongPress={enterSelect}
                selectMode={selectMode}
                selected={selFolders.has(sf.id)}
                onToggle={() => toggleFolder(sf.id)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors"
              >
                <span className="text-base">{sf.icon || "📁"}</span>
                <span className="flex-1 text-sm font-medium text-left">{sf.name}</span>
                {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </LongPressItem>
            ))}

            {subFolders.length > 0 && folderItems.length > 0 && <div className="border-t my-1" />}

            {folderItems.map((item) => (
              <LongPressItem
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                onLongPress={enterSelect}
                selectMode={selectMode}
                selected={selItems.has(item.id)}
                onToggle={() => toggleItem(item.id)}
                className="flex items-center gap-2.5 rounded-lg border p-3 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {item.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                    <span className="text-sm font-semibold line-clamp-1">{item.title || "(제목 없음)"}</span>
                  </div>
                  {item.excerpt && <span className="text-xs text-muted-foreground line-clamp-1">{item.excerpt}</span>}
                </div>
                {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </LongPressItem>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

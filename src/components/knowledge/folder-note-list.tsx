"use client";

import { useState, useRef, useCallback } from "react";
import { ArrowLeft, Pin, FileText, ChevronRight, Trash2, CheckSquare, Square } from "lucide-react";
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

export default function FolderNoteList({
  folder, folders, items, onSelectItem, onSelectFolder, onBack, onDeleteItems, onDeleteFolders,
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
  const dragRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const exitSelect = () => { setSelectMode(false); setSelFolders(new Set()); setSelItems(new Set()); };
  const totalSel = selFolders.size + selItems.size;

  const addToSelection = useCallback((id: string, type: "folder" | "item") => {
    if (type === "folder") setSelFolders((p) => new Set([...p, id]));
    else setSelItems((p) => new Set([...p, id]));
  }, []);

  const toggleSelection = useCallback((id: string, type: "folder" | "item") => {
    if (type === "folder") setSelFolders((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    else setSelItems((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  // 꾹 누르기 → 바로 선택 + 드래그 모드 시작
  const startLongPress = useCallback((id: string, type: "folder" | "item") => {
    longPressTimer.current = setTimeout(() => {
      setSelectMode(true);
      addToSelection(id, type);
      dragRef.current = true;
      // 진동 피드백 (지원 시)
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  }, [addToSelection]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  // 드래그 중 터치가 지나가는 아이템 자동 선택
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    cancelLongPress();
    if (!dragRef.current) return;
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const sel = el?.closest("[data-sel-id]") as HTMLElement | null;
    if (sel) {
      const id = sel.dataset.selId!;
      const type = sel.dataset.selType as "folder" | "item";
      addToSelection(id, type);
    }
  }, [addToSelection, cancelLongPress]);

  const handleTouchEnd = useCallback(() => {
    cancelLongPress();
    dragRef.current = false;
  }, [cancelLongPress]);

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
    <div className="flex flex-col h-full" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className="flex items-center gap-2 border-b px-3 h-14 shrink-0">
        {selectMode ? (
          <>
            <button type="button" onClick={exitSelect} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent -ml-1"><ArrowLeft className="h-5 w-5" /></button>
            <span className="text-sm font-medium flex-1">{totalSel}개 선택</span>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={selectAll}>전체</Button>
            <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={totalSel === 0} onClick={handleDelete}><Trash2 className="h-3 w-3 mr-1" />삭제</Button>
          </>
        ) : (
          <>
            <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent -ml-1"><ArrowLeft className="h-5 w-5" /></button>
            <span className="text-lg">{folder?.icon || "📁"}</span>
            <h2 className="text-base font-semibold truncate flex-1">{folder?.name || "미분류"}</h2>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {subFolders.length === 0 && folderItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <FileText className="h-10 w-10 opacity-20" />
            <p className="text-xs text-muted-foreground">이 폴더는 비어있습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {subFolders.map((sf) => (
              <div
                key={sf.id}
                data-sel-id={sf.id}
                data-sel-type="folder"
                role="button"
                tabIndex={0}
                onClick={() => selectMode ? toggleSelection(sf.id, "folder") : onSelectFolder(sf.id)}
                onTouchStart={() => startLongPress(sf.id, "folder")}
                onTouchEnd={cancelLongPress}
                onContextMenu={(e) => { e.preventDefault(); setSelectMode(true); addToSelection(sf.id, "folder"); }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors select-none ${selFolders.has(sf.id) ? "bg-primary/10" : "hover:bg-accent/50"}`}
              >
                {selectMode && (selFolders.has(sf.id) ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />)}
                <span className="text-base">{sf.icon || "📁"}</span>
                <span className="flex-1 text-sm font-medium text-left">{sf.name}</span>
                {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
            {subFolders.length > 0 && folderItems.length > 0 && <div className="border-t my-1" />}
            {folderItems.map((item) => (
              <div
                key={item.id}
                data-sel-id={item.id}
                data-sel-type="item"
                role="button"
                tabIndex={0}
                onClick={() => selectMode ? toggleSelection(item.id, "item") : onSelectItem(item.id)}
                onTouchStart={() => startLongPress(item.id, "item")}
                onTouchEnd={cancelLongPress}
                onContextMenu={(e) => { e.preventDefault(); setSelectMode(true); addToSelection(item.id, "item"); }}
                className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors select-none ${selItems.has(item.id) ? "bg-primary/10 border-primary/30" : "hover:bg-accent/50"}`}
              >
                {selectMode && (selItems.has(item.id) ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />)}
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {item.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                    <span className="text-sm font-semibold line-clamp-1">{item.title || "(제목 없음)"}</span>
                  </div>
                </div>
                {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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

export default function KnowledgeDashboard({
  folders, items, onSelectItem, onSelectFolder, onSearch, searchQuery, searchResults, onDeleteItems, onDeleteFolders,
}: DashboardProps) {
  const pinnedItems = items.filter((i) => i.pinned);
  const rootFolders = folders.filter((f) => !f.parent_id);

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

  const startLongPress = useCallback((id: string, type: "folder" | "item") => {
    longPressTimer.current = setTimeout(() => {
      setSelectMode(true);
      addToSelection(id, type);
      dragRef.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  }, [addToSelection]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    cancelLongPress();
    if (!dragRef.current) return;
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const sel = el?.closest("[data-sel-id]") as HTMLElement | null;
    if (sel) addToSelection(sel.dataset.selId!, sel.dataset.selType as "folder" | "item");
  }, [addToSelection, cancelLongPress]);

  const handleTouchEnd = useCallback(() => { cancelLongPress(); dragRef.current = false; }, [cancelLongPress]);

  const handleDelete = () => {
    if (selItems.size > 0 && onDeleteItems) onDeleteItems(Array.from(selItems));
    if (selFolders.size > 0 && onDeleteFolders) onDeleteFolders(Array.from(selFolders));
    exitSelect();
  };

  const selectAll = () => {
    setSelFolders(new Set(rootFolders.map((f) => f.id)));
    setSelItems(new Set(pinnedItems.map((i) => i.id)));
  };

  return (
    <div className="flex flex-col h-full" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {selectMode && (
        <div className="flex items-center gap-2 border-b px-3 h-12 shrink-0 bg-muted/30">
          <button type="button" onClick={exitSelect} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"><ArrowLeft className="h-4 w-4" /></button>
          <span className="text-sm font-medium flex-1">{totalSel}개 선택</span>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={selectAll}>전체</Button>
          <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={totalSel === 0} onClick={handleDelete}><Trash2 className="h-3 w-3 mr-1" />삭제</Button>
        </div>
      )}

      <div className="flex flex-col gap-4 p-4 overflow-y-auto flex-1">
        {!selectMode && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => onSearch(e.target.value)} placeholder="노트 검색..." className="pl-8 h-9 text-sm" />
          </div>
        )}

        {searchQuery.trim() && !selectMode ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">{searchResults.length}개 결과</p>
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">결과 없음</p>
            ) : searchResults.map((item) => (
              <button key={item.id} type="button" onClick={() => onSelectItem(item.id)} className="flex flex-col gap-1 rounded-lg border p-3 text-left hover:bg-accent/50 transition-colors w-full">
                <span className="text-sm font-semibold line-clamp-1">{item.title || "(제목 없음)"}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {pinnedItems.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Pin className="h-3 w-3" /> 고정됨</h3>
                {pinnedItems.map((item) => (
                  <div
                    key={item.id} data-sel-id={item.id} data-sel-type="item" role="button" tabIndex={0}
                    onClick={() => selectMode ? toggleSelection(item.id, "item") : onSelectItem(item.id)}
                    onTouchStart={() => startLongPress(item.id, "item")} onTouchEnd={cancelLongPress}
                    onContextMenu={(e) => { e.preventDefault(); setSelectMode(true); addToSelection(item.id, "item"); }}
                    className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors w-full select-none ${selItems.has(item.id) ? "bg-primary/10 border-primary/30" : "hover:bg-accent/50"}`}
                  >
                    {selectMode && (selItems.has(item.id) ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />)}
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-sm font-semibold line-clamp-1">{item.title || "(제목 없음)"}</span>
                          </div>
                  </div>
                ))}
              </section>
            )}

            {rootFolders.length > 0 && (
              <section className="flex flex-col">
                {rootFolders.map((f) => (
                  <div
                    key={f.id} data-sel-id={f.id} data-sel-type="folder" role="button" tabIndex={0}
                    onClick={() => selectMode ? toggleSelection(f.id, "folder") : onSelectFolder(f.id)}
                    onTouchStart={() => startLongPress(f.id, "folder")} onTouchEnd={cancelLongPress}
                    onContextMenu={(e) => { e.preventDefault(); setSelectMode(true); addToSelection(f.id, "folder"); }}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors select-none ${selFolders.has(f.id) ? "bg-primary/10" : "hover:bg-accent/50"}`}
                  >
                    {selectMode && (selFolders.has(f.id) ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />)}
                    <span className="text-base">{f.icon || "📁"}</span>
                    <span className="flex-1 text-sm font-medium text-left">{f.name}</span>
                    {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))}
              </section>
            )}

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

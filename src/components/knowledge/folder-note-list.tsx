"use client";

import { useState, useRef, useCallback } from "react";
import { Pin, FileText, ChevronRight, Trash2, CheckSquare, Square, Pencil, Folder, FolderInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";

interface Props {
  folder: KnowledgeFolder | null;
  folders: KnowledgeFolder[];
  items: KnowledgeItem[];
  onSelectItem: (id: string) => void;
  onSelectFolder: (folderId: string) => void;
  onBack: () => void;
  onNavigateToFolder: (folderId: string | null) => void;
  onDeleteItems?: (ids: string[]) => void;
  onDeleteFolders?: (ids: string[]) => void;
  onRenameFolder?: (id: string, name: string) => void;
  onRenameItem?: (id: string, title: string) => void;
  onMoveItems?: (ids: string[], targetFolderId: string | null) => void;
}

export default function FolderNoteList({
  folder, folders, items, onSelectItem, onSelectFolder, onBack, onNavigateToFolder,
  onDeleteItems, onDeleteFolders, onRenameFolder, onRenameItem, onMoveItems,
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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveMode, setMoveMode] = useState(false);
  const dragRef = useRef(false);

  const exitSelect = () => { setSelectMode(false); setSelFolders(new Set()); setSelItems(new Set()); setRenamingId(null); setMoveMode(false); };
  const totalSel = selFolders.size + selItems.size;

  const addToSelection = useCallback((id: string, type: "folder" | "item") => {
    if (type === "folder") setSelFolders((p) => new Set([...p, id]));
    else setSelItems((p) => new Set([...p, id]));
  }, []);

  const toggleSel = useCallback((id: string, type: "folder" | "item") => {
    if (type === "folder") setSelFolders((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    else setSelItems((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleLongPress = useCallback((id: string, type: "folder" | "item") => {
    setSelectMode(true);
    addToSelection(id, type);
    dragRef.current = true;
    if (navigator.vibrate) navigator.vibrate(30);
  }, [addToSelection]);

  // 드래그 선택
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const sel = el?.closest("[data-sel-id]") as HTMLElement | null;
    if (sel) addToSelection(sel.dataset.selId!, sel.dataset.selType as "folder" | "item");
  }, [addToSelection]);
  const handleTouchEnd = useCallback(() => { dragRef.current = false; }, []);

  const handleDelete = () => {
    if (selItems.size > 0 && onDeleteItems) onDeleteItems(Array.from(selItems));
    if (selFolders.size > 0 && onDeleteFolders) onDeleteFolders(Array.from(selFolders));
    exitSelect();
  };

  // 인라인 이름 변경
  const startRename = () => {
    const fid = Array.from(selFolders)[0];
    const iid = Array.from(selItems)[0];
    if (fid) {
      const f = folders.find((x) => x.id === fid);
      if (f) { setRenamingId(fid); setRenameValue(f.name); }
    } else if (iid) {
      const it = items.find((x) => x.id === iid);
      if (it) { setRenamingId(iid); setRenameValue(it.title); }
    }
  };
  const submitRename = () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    if (selFolders.has(renamingId) && onRenameFolder) onRenameFolder(renamingId, renameValue.trim());
    else if (selItems.has(renamingId) && onRenameItem) onRenameItem(renamingId, renameValue.trim());
    setRenamingId(null);
    exitSelect();
  };

  // 폴더 이동
  const handleMove = (targetId: string | null) => {
    if (selItems.size > 0 && onMoveItems) onMoveItems(Array.from(selItems), targetId);
    exitSelect();
  };

  // 브레드크럼
  const breadcrumbs: { id: string | null; name: string }[] = [];
  if (folder) {
    let cur: KnowledgeFolder | undefined = folder;
    while (cur) { breadcrumbs.unshift({ id: cur.id, name: cur.name }); cur = folders.find((f) => f.id === cur!.parent_id); }
  }
  breadcrumbs.unshift({ id: null, name: "지식창고" });

  return (
    <div className="flex flex-col h-full" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {/* 헤더 */}
      <div className="flex items-center gap-1 border-b px-3 h-14 shrink-0 min-w-0 overflow-hidden">
        {selectMode ? (
          <>
            <button type="button" onClick={exitSelect} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent shrink-0">
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
            <span className="text-sm font-medium flex-1">{totalSel}개 선택</span>
            {totalSel === 1 && (
              <button type="button" onClick={startRename} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
            )}
            {totalSel > 0 && selItems.size > 0 && (
              <button type="button" onClick={() => setMoveMode(true)} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"><FolderInput className="h-3.5 w-3.5" /></button>
            )}
            <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={totalSel === 0} onClick={handleDelete}>
              <Trash2 className="h-3 w-3 mr-1" />삭제
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
            {breadcrumbs.map((bc, i) => (
              <div key={bc.id ?? "root"} className="flex items-center gap-0.5 shrink-0">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                <button type="button" onClick={() => onNavigateToFolder(bc.id)}
                  className={`text-xs truncate max-w-[80px] ${i === breadcrumbs.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {bc.name}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 폴더 이동 선택 */}
      {moveMode && (
        <div className="border-b p-3 bg-muted/30 flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">이동할 폴더 선택</p>
          <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
            <button type="button" onClick={() => handleMove(null)} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent">
              <Folder className="h-3.5 w-3.5" /> 루트 (최상위)
            </button>
            {folders.filter((f) => !selFolders.has(f.id)).map((f) => (
              <button key={f.id} type="button" onClick={() => handleMove(f.id)} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent">
                <Folder className="h-3.5 w-3.5" /> {f.name}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs self-end" onClick={() => setMoveMode(false)}>취소</Button>
        </div>
      )}

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-3">
        {subFolders.length === 0 && folderItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <FileText className="h-10 w-10 opacity-20" />
            <p className="text-xs text-muted-foreground">비어있습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {subFolders.map((sf) => (
              <div key={sf.id} data-sel-id={sf.id} data-sel-type="folder" role="button" tabIndex={0}
                onClick={() => selectMode ? toggleSel(sf.id, "folder") : onSelectFolder(sf.id)}
                onTouchStart={() => { const t = setTimeout(() => handleLongPress(sf.id, "folder"), 400); (sf as any)._t = t; }}
                onTouchEnd={() => { if ((sf as any)._t) clearTimeout((sf as any)._t); }}
                onTouchMove={() => { if ((sf as any)._t) clearTimeout((sf as any)._t); }}
                onContextMenu={(e) => { e.preventDefault(); handleLongPress(sf.id, "folder"); }}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors select-none ${selFolders.has(sf.id) ? "bg-primary/10" : ""}`}
              >
                {selectMode && (selFolders.has(sf.id) ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />)}
                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                {renamingId === sf.id ? (
                  <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenamingId(null); }}
                    onClick={(e) => e.stopPropagation()} autoFocus
                    className="flex-1 text-sm font-medium bg-transparent border-b border-primary outline-none px-0.5 min-w-0" />
                ) : (
                  <span className="flex-1 text-sm font-medium text-left truncate">{sf.name}</span>
                )}
                {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
            {folderItems.map((item) => (
              <div key={item.id} data-sel-id={item.id} data-sel-type="item" role="button" tabIndex={0}
                onClick={() => selectMode ? toggleSel(item.id, "item") : onSelectItem(item.id)}
                onTouchStart={() => { const t = setTimeout(() => handleLongPress(item.id, "item"), 400); (item as any)._t = t; }}
                onTouchEnd={() => { if ((item as any)._t) clearTimeout((item as any)._t); }}
                onTouchMove={() => { if ((item as any)._t) clearTimeout((item as any)._t); }}
                onContextMenu={(e) => { e.preventDefault(); handleLongPress(item.id, "item"); }}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors select-none ${selItems.has(item.id) ? "bg-primary/10" : ""}`}
              >
                {selectMode && (selItems.has(item.id) ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />)}
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                {renamingId === item.id ? (
                  <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenamingId(null); }}
                    onClick={(e) => e.stopPropagation()} autoFocus
                    className="flex-1 text-sm bg-transparent border-b border-primary outline-none px-0.5 min-w-0" />
                ) : (
                  <span className="flex-1 text-sm text-left truncate">{item.title || "(제목 없음)"}</span>
                )}
                {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

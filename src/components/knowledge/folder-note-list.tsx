"use client";

import { useState, useRef, useCallback } from "react";
import { Pin, FileText, ChevronRight, Trash2, CheckSquare, Square, Pencil, Folder, FolderInput, ArrowLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";
import { useKnowledgeFavorites } from "@/lib/knowledge-favorites";
import MoveTargetTree from "@/components/knowledge/move-target-tree";

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
  onMoveFolders?: (ids: string[], targetFolderId: string | null) => void;
  onSelectModeChange?: (active: boolean) => void;
  onTogglePinItem?: (id: string, pinned: boolean) => Promise<void>;
}

export default function FolderNoteList({
  folder, folders, items, onSelectItem, onSelectFolder, onBack, onNavigateToFolder,
  onDeleteItems, onDeleteFolders, onRenameFolder, onRenameItem, onMoveItems, onMoveFolders,
  onSelectModeChange, onTogglePinItem,
}: Props) {
  const { toggleFolder: toggleFolderFav, isFolderFav } = useKnowledgeFavorites();
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

  const exitSelect = () => { setSelectMode(false); setSelFolders(new Set()); setSelItems(new Set()); setRenamingId(null); setMoveMode(false); onSelectModeChange?.(false); };
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
    onSelectModeChange?.(true);
    addToSelection(id, type);
    dragRef.current = true;
  }, [addToSelection, onSelectModeChange]);

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
  const doMove = (targetId: string | null) => {
    if (selItems.size > 0 && onMoveItems) onMoveItems(Array.from(selItems), targetId);
    if (selFolders.size > 0 && onMoveFolders) onMoveFolders(Array.from(selFolders), targetId);
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
      {/* 헤더 — PageHeader와 동일 규격(h-14, h-10 w-10 버튼, h-[20px] 아이콘) */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-3 min-w-0 overflow-hidden">
        {selectMode ? (
          <>
            <button type="button" onClick={exitSelect} aria-label="선택 해제" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent -ml-1">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold leading-tight truncate flex-1">{totalSel}개 선택</h1>
            <div className="flex items-center gap-0.5 shrink-0">
              {totalSel === 1 && (
                <button type="button" onClick={startRename} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" title="이름 변경" aria-label="이름 변경"><Pencil className="h-[20px] w-[20px]" strokeWidth={1.6} /></button>
              )}
              {totalSel > 0 && (
                <button type="button" onClick={() => setMoveMode(true)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" title="폴더 이동" aria-label="폴더 이동"><FolderInput className="h-[20px] w-[20px]" strokeWidth={1.6} /></button>
              )}
              <button type="button" onClick={handleDelete} disabled={totalSel === 0} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent disabled:opacity-30" title="삭제" aria-label="삭제"><Trash2 className="h-[20px] w-[20px] text-destructive" strokeWidth={1.6} /></button>
            </div>
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
      </header>

      {/* 폴더 이동 — 바텀시트 */}
      <Sheet open={moveMode} onOpenChange={setMoveMode}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] max-h-[60dvh] z-[65]" showBackButton={false} showCloseButton={false} initialFocus={false} hideOverlay>
          <div className="flex flex-col h-full">
            <div className="flex flex-col items-center pt-3 pb-2 shrink-0">
              <div className="h-1.5 w-14 rounded-full bg-muted-foreground/40 mb-3" />
              <SheetHeader className="p-0">
                <SheetTitle className="text-base text-center">이동할 폴더 선택</SheetTitle>
              </SheetHeader>
            </div>
            <div className="flex flex-col gap-0.5 px-4 pb-2 overflow-y-auto flex-1">
              <button type="button" onClick={() => doMove(null)} className="flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent font-medium">
                <Folder className="h-4 w-4" /> 루트 (최상위)
              </button>
              <MoveTargetTree folders={folders} excludeIds={selFolders} parentId={null} onSelect={doMove} />
            </div>
            <div className="px-4 pt-2 shrink-0">
              <Button size="sm" variant="outline" className="w-full h-9" onClick={() => setMoveMode(false)}>취소</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
                {!selectMode && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleFolderFav(sf.id); }}
                    className="shrink-0 p-1 rounded hover:bg-accent"
                    aria-label={isFolderFav(sf.id) ? "즐겨찾기 해제" : "즐겨찾기"}
                  >
                    <Star className={`h-3.5 w-3.5 ${isFolderFav(sf.id) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
                  </button>
                )}
                {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
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
                {!selectMode && onTogglePinItem && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onTogglePinItem(item.id, item.pinned); }}
                    className="shrink-0 p-1 rounded hover:bg-accent"
                    aria-label={item.pinned ? "즐겨찾기 해제" : "즐겨찾기"}
                  >
                    <Star className={`h-3.5 w-3.5 ${item.pinned ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
                  </button>
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

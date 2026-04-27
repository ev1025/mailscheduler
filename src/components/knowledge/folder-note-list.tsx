"use client";

import { useState, useRef, useCallback } from "react";
import { Pin, FileText, Trash2, CheckSquare, Square, Pencil, Folder, FolderInput, ArrowLeft, Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import SearchInput from "@/components/ui/search-input";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";
import MoveTargetTree from "@/components/knowledge/move-target-tree";
import KnowledgeBreadcrumb from "@/components/knowledge/breadcrumb";
import KnowledgeEmptyState from "@/components/knowledge/empty-state";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";

/* ── DnD 래퍼 — 노트는 드래그 소스, 폴더는 드롭 타겟. ── */
function DraggableNoteWrapper({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={isDragging ? "opacity-40" : ""}>
      {children}
    </div>
  );
}

function DroppableFolderWrapper({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <div ref={setNodeRef} className={`rounded-lg ${isOver ? "ring-2 ring-primary" : ""}`}>
      {children}
    </div>
  );
}

interface Props {
  folder: KnowledgeFolder | null;
  folders: KnowledgeFolder[];
  items: KnowledgeItem[];
  /** 첫 fetch 중이면 true — empty-state 플래시 방지 */
  loading?: boolean;
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
  /** 선택 프롭 — 주면 폴더 breadcrumb 위에 검색박스 표시. */
  searchQuery?: string;
  onSearch?: (q: string) => void;
  /** true 면 내부 Breadcrumb 렌더 생략 — 부모가 상위에서 별도 breadcrumb 을 이미 표시하는 경우. */
  hideBreadcrumb?: boolean;
}

export default function FolderNoteList({
  folder, folders, items, loading = false, onSelectItem, onSelectFolder, onBack, onNavigateToFolder,
  onDeleteItems, onDeleteFolders, onRenameFolder, onRenameItem, onMoveItems, onMoveFolders,
  onSelectModeChange, onTogglePinItem, searchQuery, onSearch, hideBreadcrumb,
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

  // DnD: 노트를 폴더 위로 드래그 → 그 폴더 안으로 이동.
  // selectMode 중엔 비활성 (선택 박스 드래그와 충돌 방지).
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );
  const handleDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    // 모바일 패턴: 길게 눌렀다가 이동 없이 손 뗀 경우 → 선택 모드 진입.
    const moved = Math.abs(e.delta.x) > 10 || Math.abs(e.delta.y) > 10;
    if (!e.over && !moved) {
      const f = subFolders.find((x) => x.id === activeId);
      const it = folderItems.find((x) => x.id === activeId);
      if (f) handleLongPress(f.id, "folder");
      else if (it) handleLongPress(it.id, "item");
      return;
    }
    if (!e.over) return;
    const overId = String(e.over.id);
    if (activeId === overId) return;
    const folderTarget = subFolders.find((f) => f.id === overId);
    const itemActive = folderItems.find((i) => i.id === activeId);
    if (folderTarget && itemActive && onMoveItems) {
      if (itemActive.folder_id === folderTarget.id) return;
      onMoveItems([itemActive.id], folderTarget.id);
    }
  };

  return (
    <div className="flex flex-col h-full" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {/* 상단 영역 — 선택 모드/일반 모드 상관없이 동일한 wrapper 로 유지.
          레이아웃 이동 방지: 꾹 눌러 선택 시 상단이 사라지며 손가락 아래 항목이
          엉뚱한 폴더로 밀리던 현상 해결. 선택 모드에서 검색창 자리만 툴바로 치환. */}
      {(onSearch || !hideBreadcrumb) && (
        <div className="flex flex-col gap-2 shrink-0 border-b bg-background px-3 py-3">
          {selectMode ? (
            <div className="flex h-9 items-center gap-0.5 -mx-1">
              <button type="button" onClick={exitSelect} aria-label="선택 해제" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"><ArrowLeft className="h-[18px] w-[18px]" /></button>
              <span className="flex-1 text-sm font-semibold truncate px-1">{totalSel}개 선택</span>
              {totalSel === 1 && (
                <button type="button" onClick={startRename} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" title="이름 변경" aria-label="이름 변경"><Pencil className="h-[18px] w-[18px]" strokeWidth={1.6} /></button>
              )}
              {totalSel > 0 && (
                <button type="button" onClick={() => setMoveMode(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" title="폴더 이동" aria-label="폴더 이동"><FolderInput className="h-[18px] w-[18px]" strokeWidth={1.6} /></button>
              )}
              <button type="button" onClick={handleDelete} disabled={totalSel === 0} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent disabled:opacity-30" title="삭제" aria-label="삭제"><Trash2 className="h-[18px] w-[18px] text-destructive" strokeWidth={1.6} /></button>
            </div>
          ) : onSearch ? (
            <SearchInput
              value={searchQuery ?? ""}
              onChange={onSearch}
              placeholder="노트 검색..."
              size="md"
            />
          ) : null}
          {!hideBreadcrumb && (
            <KnowledgeBreadcrumb
              folder={folder}
              folders={folders}
              onNavigate={onNavigateToFolder}
            />
          )}
        </div>
      )}

      {/* 폴더 이동 — 바텀시트. modal=false 로 외부 요소 터치·포커스 가능 +
          외부 터치 시 자동 닫힘 (Base UI dismissible 기본 true). */}
      <Sheet open={moveMode} onOpenChange={setMoveMode} modal={false}>
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
        {subFolders.length === 0 && folderItems.length === 0 && !loading ? (
          <KnowledgeEmptyState variant="no-notes-in-folder" />
        ) : subFolders.length === 0 && folderItems.length === 0 && loading ? (
          <div className="py-20" aria-hidden />
        ) : (
          <DndContext sensors={dndSensors} onDragEnd={handleDragEnd}>
            <div className="flex flex-col gap-0.5">
              {subFolders.map((sf) => (
                <DroppableFolderWrapper key={sf.id} id={sf.id} disabled={selectMode}>
                  <div data-sel-id={sf.id} data-sel-type="folder" role="button" tabIndex={0}
                    onClick={() => selectMode ? toggleSel(sf.id, "folder") : onSelectFolder(sf.id)}
                    onTouchStart={() => { const t = setTimeout(() => handleLongPress(sf.id, "folder"), 400); (sf as unknown as { _t?: ReturnType<typeof setTimeout> })._t = t; }}
                    onTouchEnd={() => { const x = (sf as unknown as { _t?: ReturnType<typeof setTimeout> })._t; if (x) clearTimeout(x); }}
                    onTouchMove={() => { const x = (sf as unknown as { _t?: ReturnType<typeof setTimeout> })._t; if (x) clearTimeout(x); }}
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
                    {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </div>
                </DroppableFolderWrapper>
              ))}
              {folderItems.map((item) => (
                <DraggableNoteWrapper key={item.id} id={item.id} disabled={selectMode || renamingId === item.id}>
                  {/* 노트는 dnd-kit TouchSensor 가 길게-누름 담당 (드래그-옮기기).
                      이동 없이 release 하면 handleDragEnd 에서 선택 모드로 진입. */}
                  <div data-sel-id={item.id} data-sel-type="item" role="button" tabIndex={0}
                    onClick={() => selectMode ? toggleSel(item.id, "item") : onSelectItem(item.id)}
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
                </DraggableNoteWrapper>
              ))}
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}

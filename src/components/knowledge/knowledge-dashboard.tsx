"use client";

import { useState, useRef, useCallback } from "react";
import { Search, Star, ChevronRight, FileText, Folder, Trash2, CheckSquare, Square, ArrowLeft, Pencil, FolderInput } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";
import { useKnowledgeFavorites } from "@/lib/knowledge-favorites";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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
  onRenameFolder?: (id: string, name: string) => void;
  onRenameItem?: (id: string, title: string) => void;
  onReorderFolders?: (ids: string[]) => void;
  onSelectModeChange?: (active: boolean) => void;
  onMoveItems?: (ids: string[], targetFolderId: string | null) => void;
  onMoveFolders?: (ids: string[], targetFolderId: string | null) => void;
  onTogglePinItem?: (id: string, pinned: boolean) => Promise<void>;
}

/* ── 이동 대상 트리 ── */
function MoveTree({ folders, excludeIds, parentId, depth, onSelect }: {
  folders: KnowledgeFolder[]; excludeIds: Set<string>; parentId: string | null; depth: number; onSelect: (id: string) => void;
}) {
  const children = folders.filter((f) => f.parent_id === parentId && !excludeIds.has(f.id));
  if (children.length === 0) return null;
  return (
    <>
      {children.map((f) => (
        <div key={f.id}>
          <button type="button" onClick={() => onSelect(f.id)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
            style={{ paddingLeft: (depth + 1) * 16 + 8 }}>
            <Folder className="h-3.5 w-3.5 shrink-0" /> {f.name}
          </button>
          <MoveTree folders={folders} excludeIds={excludeIds} parentId={f.id} depth={depth + 1} onSelect={onSelect} />
        </div>
      ))}
    </>
  );
}

/* ── 노트 트리 행 ── */
function NoteTreeRow({ item, depth, selectMode, selected, onToggle, onClick, onLongPress, renamingId, renameValue, onRenameChange, onRenameSubmit, isFavorite, onToggleFavorite }: {
  item: KnowledgeItem; depth: number; selectMode: boolean; selected: boolean;
  onToggle: () => void; onClick: () => void; onLongPress: () => void;
  renamingId: string | null; renameValue: string; onRenameChange: (v: string) => void; onRenameSubmit: () => void;
  isFavorite: boolean; onToggleFavorite?: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRenaming = renamingId === item.id;
  return (
    <div
      data-sel-id={item.id} data-sel-type="item" role="button" tabIndex={0}
      onClick={selectMode ? onToggle : onClick}
      onTouchStart={() => { timerRef.current = setTimeout(onLongPress, 400); }}
      onTouchEnd={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
      onTouchMove={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      className={`flex items-center gap-1.5 rounded-lg py-2 pr-2 transition-colors select-none ${selected ? "bg-primary/10" : "hover:bg-accent/50"}`}
      style={{ paddingLeft: depth * 16 + 4 }}
    >
      <span className="w-5 shrink-0" />
      {selectMode && (selected ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />)}
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      {isRenaming ? (
        <input
          value={renameValue} onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onRenameSubmit(); if (e.key === "Escape") onRenameSubmit(); }}
          onClick={(e) => e.stopPropagation()}
          autoFocus className="flex-1 text-sm bg-transparent border-b border-primary outline-none px-0.5 min-w-0"
        />
      ) : (
        <span className="flex-1 text-sm text-left truncate">{item.title || "(제목 없음)"}</span>
      )}
      {!selectMode && onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="shrink-0 p-1 rounded hover:bg-accent"
          aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
        >
          <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
        </button>
      )}
    </div>
  );
}

/* ── Sortable 래퍼 ── */
function SortableFolderRow(props: Parameters<typeof FolderTreeRow>[0]) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.folder.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} {...attributes} {...listeners}>
      <FolderTreeRow {...props} />
    </div>
  );
}

/* ── 재귀 폴더 트리 행 ── */
function FolderTreeRow({
  folder,
  allFolders,
  allItems,
  depth,
  expanded,
  onToggle,
  selectMode,
  selFolders,
  selItems,
  onToggleFolder,
  onToggleItem,
  onClickFolder,
  onClickItem,
  onLongPress,
  renamingId,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  isFolderFavorite,
  onToggleFolderFavorite,
}: {
  folder: KnowledgeFolder;
  allFolders: KnowledgeFolder[];
  allItems: KnowledgeItem[];
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectMode: boolean;
  selFolders: Set<string>;
  selItems: Set<string>;
  onToggleFolder: (id: string) => void;
  onToggleItem: (id: string) => void;
  onClickFolder: (id: string) => void;
  onClickItem: (id: string) => void;
  onLongPress: (id: string, type: "folder" | "item") => void;
  renamingId: string | null;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  isFolderFavorite: (id: string) => boolean;
  onToggleFolderFavorite: (id: string) => void;
}) {
  const subFolders = allFolders.filter((f) => f.parent_id === folder.id);
  const hasChildren = subFolders.length > 0;
  const isOpen = expanded.has(folder.id);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <div>
      {/* 폴더 행 */}
      <div
        data-sel-id={folder.id} data-sel-type="folder"
        role="button" tabIndex={0}
        onClick={() => selectMode ? onToggleFolder(folder.id) : onClickFolder(folder.id)}
        onTouchStart={() => { timerRef.current = setTimeout(() => onLongPress(folder.id, "folder"), 400); }}
        onTouchEnd={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
        onTouchMove={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
        onContextMenu={(e) => { e.preventDefault(); onLongPress(folder.id, "folder"); }}
        className={`flex items-center gap-1.5 rounded-lg py-2 pr-2 transition-colors select-none ${
          selFolders.has(folder.id) ? "bg-primary/10" : "hover:bg-accent/50"
        }`}
        style={{ paddingLeft: depth * 16 + 4 }}
      >
        {/* 토글 화살표 */}
        {hasChildren && !selectMode ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(folder.id); }}
            className="flex h-5 w-5 items-center justify-center shrink-0 text-muted-foreground"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        {selectMode && (selFolders.has(folder.id)
          ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
        {renamingId === folder.id ? (
          <input
            value={renameValue} onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onRenameSubmit(); if (e.key === "Escape") onRenameSubmit(); }}
            onClick={(e) => e.stopPropagation()}
            autoFocus className="flex-1 text-sm font-medium bg-transparent border-b border-primary outline-none px-0.5 min-w-0"
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-left truncate">{folder.name}</span>
        )}
        {!selectMode && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleFolderFavorite(folder.id); }}
            className="shrink-0 p-1 rounded hover:bg-accent"
            aria-label={isFolderFavorite(folder.id) ? "즐겨찾기 해제" : "즐겨찾기"}
          >
            <Star className={`h-3.5 w-3.5 ${isFolderFavorite(folder.id) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
          </button>
        )}
      </div>

      {/* 하위 콘텐츠 (토글 열림 시) */}
      {isOpen && hasChildren && (
        <div>
          {/* 하위 폴더 — 재귀 */}
          {subFolders.map((sf) => (
            <FolderTreeRow
              key={sf.id}
              folder={sf}
              allFolders={allFolders}
              allItems={allItems}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectMode={selectMode}
              selFolders={selFolders}
              selItems={selItems}
              onToggleFolder={onToggleFolder}
              onToggleItem={onToggleItem}
              onClickFolder={onClickFolder}
              onClickItem={onClickItem}
              onLongPress={onLongPress}
              renamingId={renamingId}
              renameValue={renameValue}
              onRenameChange={onRenameChange}
              onRenameSubmit={onRenameSubmit}
              isFolderFavorite={isFolderFavorite}
              onToggleFolderFavorite={onToggleFolderFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 메인 대시보드 ── */
export default function KnowledgeDashboard({
  folders, items, onSelectItem, onSelectFolder, onSearch, searchQuery, searchResults, onDeleteItems, onDeleteFolders, onRenameFolder, onRenameItem, onReorderFolders, onSelectModeChange, onMoveItems, onMoveFolders, onTogglePinItem,
}: DashboardProps) {
  const { toggleFolder: toggleFolderFav, isFolderFav, favoriteFolderIds } = useKnowledgeFavorites();
  // 즐겨찾기 = DB pinned (items) + localStorage favorites (folders)
  const favoriteItems = items.filter((i) => i.pinned);
  const favoriteFolders = folders.filter((f) => favoriteFolderIds.includes(f.id));
  const rootFolders = folders.filter((f) => !f.parent_id);

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id || !onReorderFolders) return;
    const oldIdx = rootFolders.findIndex((f) => f.id === e.active.id);
    const newIdx = rootFolders.findIndex((f) => f.id === e.over!.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(rootFolders, oldIdx, newIdx);
    onReorderFolders(reordered.map((f) => f.id));
  };

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // 선택 모드 + 인라인 이름 변경
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
  const toggleSelection = useCallback((id: string, type: "folder" | "item") => {
    if (type === "folder") setSelFolders((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    else setSelItems((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleLongPress = useCallback((id: string, type: "folder" | "item") => {
    setSelectMode(true);
    onSelectModeChange?.(true);
    addToSelection(id, type);
    dragRef.current = true;
  }, [addToSelection, onSelectModeChange]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const sel = el?.closest("[data-sel-id]") as HTMLElement | null;
    if (sel) addToSelection(sel.dataset.selId!, sel.dataset.selType as "folder" | "item");
  }, [addToSelection]);
  const handleTouchEnd = useCallback(() => { dragRef.current = false; }, []);

  const handleDeleteBulk = () => {
    if (selItems.size > 0 && onDeleteItems) onDeleteItems(Array.from(selItems));
    if (selFolders.size > 0 && onDeleteFolders) onDeleteFolders(Array.from(selFolders));
    exitSelect();
  };

  // ✏️ 버튼: 1개 선택 → 인라인 이름 변경 시작
  const startInlineRename = () => {
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
  const doMove = (targetId: string | null) => {
    if (selItems.size > 0 && onMoveItems) onMoveItems(Array.from(selItems), targetId);
    if (selFolders.size > 0 && onMoveFolders) onMoveFolders(Array.from(selFolders), targetId);
    exitSelect();
  };

  const submitRename = () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    if (selFolders.has(renamingId) && onRenameFolder) onRenameFolder(renamingId, renameValue.trim());
    else if (selItems.has(renamingId) && onRenameItem) onRenameItem(renamingId, renameValue.trim());
    setRenamingId(null);
    exitSelect();
  };

  return (
    <div className="flex flex-col h-full" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {/* 선택 모드 툴바 — PageHeader와 동일 규격(h-14, h-10 w-10 버튼, h-[20px] 아이콘) */}
      {selectMode && (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-3">
          <button type="button" onClick={exitSelect} aria-label="선택 해제" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent -ml-1"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-lg font-bold leading-tight truncate flex-1">{totalSel}개 선택</h1>
          <div className="flex items-center gap-0.5 shrink-0">
            {totalSel === 1 && (
              <button type="button" onClick={startInlineRename} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" title="이름 변경" aria-label="이름 변경"><Pencil className="h-[20px] w-[20px]" strokeWidth={1.6} /></button>
            )}
            {totalSel > 0 && (
              <button type="button" onClick={() => setMoveMode(true)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" title="폴더 이동" aria-label="폴더 이동"><FolderInput className="h-[20px] w-[20px]" strokeWidth={1.6} /></button>
            )}
            <button type="button" onClick={handleDeleteBulk} disabled={totalSel === 0} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent disabled:opacity-30" title="삭제" aria-label="삭제"><Trash2 className="h-[20px] w-[20px] text-destructive" strokeWidth={1.6} /></button>
          </div>
        </header>
      )}

      {/* 폴더 이동 — 바텀시트 */}
      <Sheet open={moveMode} onOpenChange={setMoveMode}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] max-h-[60dvh] z-[65]" showBackButton={false} showCloseButton={false} initialFocus={false}>
          <div className="flex flex-col h-full">
            <div className="flex flex-col items-center pt-3 pb-2 shrink-0">
              <div className="h-1.5 w-14 rounded-full bg-muted-foreground/40 mb-3" />
              <SheetHeader className="p-0">
                <SheetTitle className="text-base text-center">이동할 폴더 선택</SheetTitle>
              </SheetHeader>
            </div>
            <div className="flex flex-col gap-0.5 px-4 pb-2 overflow-y-auto flex-1">
              <button type="button" onClick={() => { doMove(null); }}
                className="flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent font-medium"><Folder className="h-4 w-4" /> 루트 (최상위)</button>
              <MoveTree folders={folders} excludeIds={selFolders} parentId={null} depth={0} onSelect={(id) => doMove(id)} />
            </div>
            <div className="px-4 pt-2 shrink-0">
              <Button size="sm" variant="outline" className="w-full h-9" onClick={() => setMoveMode(false)}>취소</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1">
        {!selectMode && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => onSearch(e.target.value)} placeholder="노트 검색..." className="pl-8 h-9 text-sm" />
          </div>
        )}

        {searchQuery.trim() && !selectMode ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">{searchResults.length}개 결과</p>
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">결과 없음</p>
            ) : searchResults.map((item) => (
              <button key={item.id} type="button" onClick={() => onSelectItem(item.id)}
                className="flex items-center gap-2 rounded-lg border p-2.5 text-left hover:bg-accent/50 transition-colors w-full">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium line-clamp-1">{item.title || "(제목 없음)"}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* 즐겨찾기 — 폴더 + 파일 모두 */}
            {(favoriteFolders.length > 0 || favoriteItems.length > 0) && (
              <section className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-0.5">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> 즐겨찾기
                </h3>
                {favoriteFolders.map((f) => (
                  <div
                    key={f.id} data-sel-id={f.id} data-sel-type="folder" role="button" tabIndex={0}
                    onClick={() => selectMode ? toggleSelection(f.id, "folder") : onSelectFolder(f.id)}
                    onContextMenu={(e) => { e.preventDefault(); handleLongPress(f.id, "folder"); }}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors select-none ${selFolders.has(f.id) ? "bg-primary/10 border-primary/30" : "hover:bg-accent/50"}`}
                  >
                    {selectMode && (selFolders.has(f.id) ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />)}
                    <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium line-clamp-1 flex-1">{f.name}</span>
                    {!selectMode && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleFolderFav(f.id); }}
                        className="shrink-0 p-1 rounded hover:bg-accent"
                        aria-label="즐겨찾기 해제"
                      >
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      </button>
                    )}
                  </div>
                ))}
                {favoriteItems.map((item) => (
                  <div
                    key={item.id} data-sel-id={item.id} data-sel-type="item" role="button" tabIndex={0}
                    onClick={() => selectMode ? toggleSelection(item.id, "item") : onSelectItem(item.id)}
                    onContextMenu={(e) => { e.preventDefault(); handleLongPress(item.id, "item"); }}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors select-none ${selItems.has(item.id) ? "bg-primary/10 border-primary/30" : "hover:bg-accent/50"}`}
                  >
                    {selectMode && (selItems.has(item.id) ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />)}
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium line-clamp-1 flex-1">{item.title || "(제목 없음)"}</span>
                    {!selectMode && onTogglePinItem && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onTogglePinItem(item.id, item.pinned); }}
                        className="shrink-0 p-1 rounded hover:bg-accent"
                        aria-label="즐겨찾기 해제"
                      >
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      </button>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* 폴더 트리 (드래그 정렬 + 재귀) */}
            {rootFolders.length > 0 && (
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={rootFolders.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  <section className="flex flex-col">
                    {rootFolders.map((f) => (
                      <SortableFolderRow
                        key={f.id}
                        folder={f}
                        allFolders={folders}
                        allItems={items}
                        depth={0}
                        expanded={expanded}
                        onToggle={toggleExpand}
                        selectMode={selectMode}
                        selFolders={selFolders}
                        selItems={selItems}
                        onToggleFolder={(id) => toggleSelection(id, "folder")}
                        onToggleItem={(id) => toggleSelection(id, "item")}
                        onClickFolder={onSelectFolder}
                        onClickItem={onSelectItem}
                        onLongPress={handleLongPress}
                    renamingId={renamingId}
                    renameValue={renameValue}
                    onRenameChange={setRenameValue}
                    onRenameSubmit={submitRename}
                    isFolderFavorite={isFolderFav}
                    onToggleFolderFavorite={toggleFolderFav}
                      />
                    ))}
                  </section>
                </SortableContext>
              </DndContext>
            )}

            {favoriteItems.length === 0 && favoriteFolders.length === 0 && rootFolders.length === 0 && !selectMode && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <FileText className="h-12 w-12 opacity-20" />
                <p className="text-sm text-muted-foreground">폴더를 만들어 노트를 정리해보세요</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

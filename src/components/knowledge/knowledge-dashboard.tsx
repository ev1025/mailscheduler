"use client";

import { useState, useRef, useCallback } from "react";
import { Search, Pin, ChevronRight, FileText, Folder, Trash2, CheckSquare, Square, ArrowLeft, Pencil } from "lucide-react";
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
  onRenameFolder?: (id: string, name: string) => void;
  onRenameItem?: (id: string, title: string) => void;
}

/* ── 노트 트리 행 ── */
function NoteTreeRow({ item, depth, selectMode, selected, onToggle, onClick, onLongPress, renamingId, renameValue, onRenameChange, onRenameSubmit }: {
  item: KnowledgeItem; depth: number; selectMode: boolean; selected: boolean;
  onToggle: () => void; onClick: () => void; onLongPress: () => void;
  renamingId: string | null; renameValue: string; onRenameChange: (v: string) => void; onRenameSubmit: () => void;
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
}) {
  const subFolders = allFolders.filter((f) => f.parent_id === folder.id);
  // 이 폴더에 직접 속한 노트만 (하위 폴더의 노트는 제외)
  const directNotes = allItems.filter((i) => i.folder_id === folder.id);
  const hasChildren = subFolders.length > 0 || directNotes.length > 0;
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
            />
          ))}
          {/* 이 폴더에 직접 속한 노트 */}
          {directNotes.map((item) => (
            <NoteTreeRow
              key={item.id}
              item={item}
              depth={depth + 1}
              selectMode={selectMode}
              selected={selItems.has(item.id)}
              onToggle={() => onToggleItem(item.id)}
              onClick={() => onClickItem(item.id)}
              onLongPress={() => onLongPress(item.id, "item")}
              renamingId={renamingId}
              renameValue={renameValue}
              onRenameChange={onRenameChange}
              onRenameSubmit={onRenameSubmit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 메인 대시보드 ── */
export default function KnowledgeDashboard({
  folders, items, onSelectItem, onSelectFolder, onSearch, searchQuery, searchResults, onDeleteItems, onDeleteFolders, onRenameFolder, onRenameItem,
}: DashboardProps) {
  const pinnedItems = items.filter((i) => i.pinned);
  const rootFolders = folders.filter((f) => !f.parent_id);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // 선택 모드 + 인라인 이름 변경
  const [selectMode, setSelectMode] = useState(false);
  const [selFolders, setSelFolders] = useState<Set<string>>(new Set());
  const [selItems, setSelItems] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const dragRef = useRef(false);

  const exitSelect = () => { setSelectMode(false); setSelFolders(new Set()); setSelItems(new Set()); setRenamingId(null); };
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
    addToSelection(id, type);
    dragRef.current = true;
    if (navigator.vibrate) navigator.vibrate(30);
  }, [addToSelection]);

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
  const submitRename = () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    if (selFolders.has(renamingId) && onRenameFolder) onRenameFolder(renamingId, renameValue.trim());
    else if (selItems.has(renamingId) && onRenameItem) onRenameItem(renamingId, renameValue.trim());
    setRenamingId(null);
    exitSelect();
  };

  return (
    <div className="flex flex-col h-full" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {/* 선택 모드 툴바 */}
      {selectMode && (
        <div className="flex items-center gap-2 border-b px-3 h-12 shrink-0 bg-muted/30">
          <button type="button" onClick={exitSelect} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"><ArrowLeft className="h-4 w-4" /></button>
          <span className="text-sm font-medium flex-1">{totalSel}개 선택</span>
          {totalSel === 1 && (
            <button type="button" onClick={startInlineRename} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
          )}
          <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={totalSel === 0} onClick={handleDeleteBulk}><Trash2 className="h-3 w-3 mr-1" />삭제</Button>
        </div>
      )}

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
            {/* 고정 노트 */}
            {pinnedItems.length > 0 && (
              <section className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-0.5"><Pin className="h-3 w-3" /> 고정됨</h3>
                {pinnedItems.map((item) => (
                  <div
                    key={item.id} data-sel-id={item.id} data-sel-type="item" role="button" tabIndex={0}
                    onClick={() => selectMode ? toggleSelection(item.id, "item") : onSelectItem(item.id)}
                    onContextMenu={(e) => { e.preventDefault(); handleLongPress(item.id, "item"); }}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors select-none ${selItems.has(item.id) ? "bg-primary/10 border-primary/30" : "hover:bg-accent/50"}`}
                  >
                    {selectMode && (selItems.has(item.id) ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />)}
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium line-clamp-1 flex-1">{item.title || "(제목 없음)"}</span>
                  </div>
                ))}
              </section>
            )}

            {/* 폴더 트리 (재귀) */}
            {rootFolders.length > 0 && (
              <section className="flex flex-col">
                {rootFolders.map((f) => (
                  <FolderTreeRow
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
                  />
                ))}
              </section>
            )}

            {pinnedItems.length === 0 && rootFolders.length === 0 && !selectMode && (
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

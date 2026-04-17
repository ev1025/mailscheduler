"use client";

import { useState, useRef } from "react";
import { Pin, FileText, ChevronRight, Trash2, CheckSquare, Square, Pencil, Folder } from "lucide-react";
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
}

function LongPressDiv({
  children, onClick, onLongPress, selectMode, selected, onToggle, className,
}: {
  children: React.ReactNode; onClick: () => void; onLongPress: () => void;
  selectMode: boolean; selected: boolean; onToggle: () => void; className?: string;
}) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div
      role="button" tabIndex={0}
      onClick={selectMode ? onToggle : onClick}
      onTouchStart={() => { t.current = setTimeout(onLongPress, 400); }}
      onTouchEnd={() => { if (t.current) clearTimeout(t.current); }}
      onTouchMove={() => { if (t.current) clearTimeout(t.current); }}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      className={`${className} ${selected ? "bg-primary/10" : ""}`}
    >
      {selectMode && (selected
        ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
        : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      {children}
    </div>
  );
}

export default function FolderNoteList({
  folder, folders, items, onSelectItem, onSelectFolder, onBack, onNavigateToFolder,
  onDeleteItems, onDeleteFolders, onRenameFolder,
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

  const exitSelect = () => { setSelectMode(false); setSelFolders(new Set()); setSelItems(new Set()); };
  const totalSel = selFolders.size + selItems.size;
  const enterSelect = (id: string, type: "folder" | "item") => {
    setSelectMode(true);
    if (type === "folder") setSelFolders((p) => new Set([...p, id]));
    else setSelItems((p) => new Set([...p, id]));
    if (navigator.vibrate) navigator.vibrate(30);
  };
  const toggleFolder = (id: string) => setSelFolders((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleItem = (id: string) => setSelItems((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleDelete = () => {
    if (selItems.size > 0 && onDeleteItems) onDeleteItems(Array.from(selItems));
    if (selFolders.size > 0 && onDeleteFolders) onDeleteFolders(Array.from(selFolders));
    exitSelect();
  };

  // 브레드크럼 경로 생성
  const breadcrumbs: { id: string | null; name: string }[] = [];
  if (folder) {
    let cur: KnowledgeFolder | undefined = folder;
    while (cur) {
      breadcrumbs.unshift({ id: cur.id, name: cur.name });
      cur = folders.find((f) => f.id === cur!.parent_id);
    }
  }
  breadcrumbs.unshift({ id: null, name: "지식창고" });

  // 폴더 이름 변경
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const startRename = () => {
    if (folder) { setRenameValue(folder.name); setRenaming(true); }
  };
  const submitRename = () => {
    if (folder && renameValue.trim() && onRenameFolder) {
      onRenameFolder(folder.id, renameValue.trim());
    }
    setRenaming(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-1 border-b px-3 h-14 shrink-0 min-w-0 overflow-hidden">
        {selectMode ? (
          <>
            <button type="button" onClick={exitSelect} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent shrink-0">
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
            <span className="text-sm font-medium flex-1">{totalSel}개 선택</span>
            <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={totalSel === 0} onClick={handleDelete}>
              <Trash2 className="h-3 w-3 mr-1" />삭제
            </Button>
          </>
        ) : (
          <>
            {/* 브레드크럼 */}
            <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
              {breadcrumbs.map((bc, i) => (
                <div key={bc.id ?? "root"} className="flex items-center gap-0.5 shrink-0">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <button
                    type="button"
                    onClick={() => onNavigateToFolder(bc.id)}
                    className={`text-xs truncate max-w-[80px] ${
                      i === breadcrumbs.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {bc.name}
                  </button>
                </div>
              ))}
            </div>
            {/* 폴더 이름 변경 */}
            {folder && onRenameFolder && (
              <button type="button" onClick={startRename} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent shrink-0">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* 이름 변경 인라인 */}
      {renaming && (
        <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/30">
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenaming(false); }}
            autoFocus
            className="flex-1 h-8 rounded-md border bg-background px-2 text-sm"
          />
          <Button size="sm" className="h-8 text-xs" onClick={submitRename}>변경</Button>
        </div>
      )}

      {/* 콘텐츠 — 폴더+파일 구분 없이 통합 목록 */}
      <div className="flex-1 overflow-y-auto p-3">
        {subFolders.length === 0 && folderItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <FileText className="h-10 w-10 opacity-20" />
            <p className="text-xs text-muted-foreground">비어있습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {subFolders.map((sf) => (
              <LongPressDiv
                key={sf.id}
                onClick={() => onSelectFolder(sf.id)}
                onLongPress={() => enterSelect(sf.id, "folder")}
                selectMode={selectMode} selected={selFolders.has(sf.id)} onToggle={() => toggleFolder(sf.id)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors select-none"
              >
                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium text-left truncate">{sf.name}</span>
                {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </LongPressDiv>
            ))}
            {folderItems.map((item) => (
              <LongPressDiv
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                onLongPress={() => enterSelect(item.id, "item")}
                selectMode={selectMode} selected={selItems.has(item.id)} onToggle={() => toggleItem(item.id)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors select-none"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm text-left truncate">{item.title || "(제목 없음)"}</span>
                {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </LongPressDiv>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Star, ChevronRight, FileText, Folder, Trash2, CheckSquare, Square, ArrowLeft, Pencil, FolderInput } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/ui/search-input";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";
import { useKnowledgeFavorites } from "@/lib/knowledge-favorites";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MoveTargetTree from "@/components/knowledge/move-target-tree";
import KnowledgeEmptyState from "@/components/knowledge/empty-state";

interface DashboardProps {
  folders: KnowledgeFolder[];
  items: KnowledgeItem[];
  /** 첫 fetch 중이면 true — empty-state 플래시 방지 */
  loading?: boolean;
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
  /** 같은 parentId 에 속한 item 들의 순서 업데이트. 배열 순서 그대로 sort_order 재번호. */
  onReorderItems?: (orderedIds: string[], parentId: string | null) => void | Promise<void>;
  onSelectModeChange?: (active: boolean) => void;
  onMoveItems?: (ids: string[], targetFolderId: string | null) => void;
  onMoveFolders?: (ids: string[], targetFolderId: string | null) => void;
  onTogglePinItem?: (id: string, pinned: boolean) => Promise<void>;
  /** true 면 내부 SearchInput 렌더 생략 — 부모가 상위에서 별도 검색박스를 제공하는 경우. */
  hideSearch?: boolean;
  /** 방금 생성된 폴더 id — 대시보드 마운트 후 즉시 인라인 이름편집 진입시키는 신호. */
  pendingRenameFolderId?: string | null;
  /** pendingRenameFolderId 소비 완료 알림 — 부모에서 state 비우기 위해. */
  onConsumeRename?: () => void;
}

/* ── 노트 트리 행 ── */
export function NoteTreeRow({ item, depth, selectMode, selected, onToggle, onClick, onLongPress, renamingId, renameValue, onRenameChange, onRenameSubmit, isFavorite, onToggleFavorite }: {
  item: KnowledgeItem; depth: number; selectMode: boolean; selected: boolean;
  onToggle: () => void; onClick: () => void; onLongPress: () => void;
  renamingId: string | null; renameValue: string; onRenameChange: (v: string) => void; onRenameSubmit: () => void;
  isFavorite: boolean; onToggleFavorite?: () => void;
}) {
  const isRenaming = renamingId === item.id;
  // 모바일 길게-누름은 dnd-kit TouchSensor 가 담당 (드래그-옮기기).
  // 이동 없이 손 뗀 경우는 부모의 handleDragEnd 에서 선택 모드 진입으로 처리.
  // 데스크톱 우클릭(onContextMenu)은 selectMode 진입 유지.
  return (
    <div
      data-sel-id={item.id} data-sel-type="item" role="button" tabIndex={0}
      onClick={selectMode ? onToggle : onClick}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      className={`flex items-center gap-1.5 rounded-lg py-2 pr-2 transition-colors select-none ${selected ? "bg-primary/10" : "hover:bg-accent/50"}`}
      style={{ paddingLeft: depth * 16 }}
    >
      {/* 폴더 토글 화살표와 같은 크기(h-5 w-5) placeholder — 파일·폴더 아이콘 수직 정렬. */}
      <span className="h-5 w-5 shrink-0" />
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

/* ── Sortable 래퍼 ──
   인디케이터: isOver(드래그 항목이 자기 위에 있고 자기 자신 아닐 때) 일 때
   row 위쪽에 2px primary 라인을 띄워 drop 위치를 시각화.
   폴더 row 는 추가로 drop=안으로 이동 시 'ring' 으로 강조 (item→folder 드롭). */
function SortableFolderRow(props: Parameters<typeof FolderTreeRow>[0]) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, over, active } =
    useSortable({ id: props.folder.id, data: { kind: "folder" }, disabled: props.selectMode });
  const isOver = over?.id === props.folder.id && active?.id !== props.folder.id;
  // 같은 SortableContext(폴더-폴더) 면 정렬, 아니면(노트-폴더) 안으로
  const isFolderReorder = isOver && active?.data?.current?.kind === "folder";
  const isItemDroppingIn = isOver && !isFolderReorder;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
      className={`relative ${
        isOver && isFolderReorder
          ? "before:absolute before:-top-[3px] before:left-2 before:right-2 before:h-0.5 before:bg-primary before:rounded-full"
          : ""
      } ${
        isItemDroppingIn && !isFolderReorder
          ? "ring-2 ring-primary rounded-md"
          : ""
      }`}
    >
      <FolderTreeRow {...props} />
    </div>
  );
}

// 노트(파일) 행도 드래그 재정렬 가능하게 래핑. item id 기준.
function SortableNoteRow(props: Parameters<typeof NoteTreeRow>[0]) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, over, active } =
    useSortable({ id: props.item.id, data: { kind: "item" }, disabled: props.selectMode });
  const isOver = over?.id === props.item.id && active?.id !== props.item.id;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
      className={`relative ${
        isOver
          ? "before:absolute before:-top-[3px] before:left-2 before:right-2 before:h-0.5 before:bg-primary before:rounded-full"
          : ""
      }`}
    >
      <NoteTreeRow {...props} />
    </div>
  );
}

/* ── 재귀 폴더 트리 행 ── */
export function FolderTreeRow({
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
  // 토글 내부엔 하위 폴더만 노출. 파일은 해당 폴더 진입 시 보이는 방식으로.
  const hasChildren = subFolders.length > 0;
  const isOpen = expanded.has(folder.id);
  // 모바일 길게-누름은 dnd-kit TouchSensor 가 담당 (드래그-옮기기).

  return (
    <div>
      {/* 폴더 행 */}
      <div
        data-sel-id={folder.id} data-sel-type="folder"
        role="button" tabIndex={0}
        onClick={() => selectMode ? onToggleFolder(folder.id) : onClickFolder(folder.id)}
        onContextMenu={(e) => { e.preventDefault(); onLongPress(folder.id, "folder"); }}
        className={`flex items-center gap-1.5 rounded-lg py-2 pr-2 transition-colors select-none ${
          selFolders.has(folder.id) ? "bg-primary/10" : "hover:bg-accent/50"
        }`}
        style={{ paddingLeft: depth * 16 }}
      >
        {/* 토글 화살표 — 하위 있을 때만 실제 렌더. 없으면 같은 크기 placeholder 로 아이콘 정렬 유지. */}
        {hasChildren && !selectMode ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(folder.id); }}
            className="flex h-5 w-5 items-center justify-center shrink-0 text-muted-foreground"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" />
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
        {/* 폴더는 즐겨찾기 대상이 아님 — 글 전용 정책 → 별 버튼 제거. */}
      </div>

      {/* 하위 콘텐츠 (토글 열림 시) — 하위 폴더만 재귀 렌더. 파일은 폴더 진입 시 노출. */}
      {isOpen && hasChildren && (
        <div>
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
  folders, items, loading = false, onSelectItem, onSelectFolder, onSearch, searchQuery, searchResults, onDeleteItems, onDeleteFolders, onRenameFolder, onRenameItem, onReorderFolders, onReorderItems, onSelectModeChange, onMoveItems, onMoveFolders, onTogglePinItem, hideSearch, pendingRenameFolderId, onConsumeRename,
}: DashboardProps) {
  const { toggleFolder: toggleFolderFav, isFolderFav, favoriteFolderIds } = useKnowledgeFavorites();
  // 즐겨찾기 = DB pinned (items) + localStorage favorites (folders)
  // 즐겨찾기는 글(파일) 전용 — 웹/모바일 통일.
  const favoriteItems = items.filter((i) => i.pinned);
  const rootFolders = folders.filter((f) => !f.parent_id);
  // 폴더에 속하지 않는 최상위 노트들 — 대시보드 하단에 플랫하게 노출해야 접근 가능.
  const rootItems = items
    .filter((i) => !i.folder_id)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  // 모바일 터치는 PointerSensor 만으로는 잘 안 잡혀 TouchSensor 추가.
  // delay 250ms — 짧은 탭(클릭)·짧은 스크롤은 DnD 발동 안 함.
  // selectMode 진입 long-press(400ms) 이전에 드래그 시작하면 DnD 우선.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );
  // 드래그 종료 — active 가 폴더 or item 인지 판별해 각각의 재정렬·이동 훅에 위임.
  const handleDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    // 모바일 패턴: 길게 눌렀다가 이동 없이 손 뗀 경우 → 선택 모드 진입.
    // TouchSensor delay 250ms 이후 release & delta≈0 이면 사용자가 "선택"하려던 의도로 간주.
    const moved = Math.abs(e.delta.x) > 10 || Math.abs(e.delta.y) > 10;
    if ((!e.over || activeId === String(e.over.id)) && !moved) {
      const f = folders.find((x) => x.id === activeId);
      const it = items.find((x) => x.id === activeId);
      if (f) handleLongPress(f.id, "folder");
      else if (it) handleLongPress(it.id, "item");
      return;
    }
    if (!e.over || e.active.id === e.over.id) return;
    const overId = String(e.over.id);
    // 폴더-폴더 재정렬 (루트)
    const folderActive = rootFolders.find((f) => f.id === activeId);
    const folderOver = rootFolders.find((f) => f.id === overId);
    if (folderActive && folderOver && onReorderFolders) {
      const oldIdx = rootFolders.findIndex((f) => f.id === activeId);
      const newIdx = rootFolders.findIndex((f) => f.id === overId);
      const reordered = arrayMove(rootFolders, oldIdx, newIdx);
      onReorderFolders(reordered.map((f) => f.id));
      return;
    }
    // 노트 → 폴더 드롭: 해당 폴더 안으로 이동 (parent_id = folder.id).
    const itemActive = items.find((i) => i.id === activeId);
    const folderTarget = folders.find((f) => f.id === overId);
    if (itemActive && folderTarget && onMoveItems) {
      if (itemActive.folder_id === folderTarget.id) return; // 이미 그 폴더 안
      onMoveItems([itemActive.id], folderTarget.id);
      return;
    }
    // 아이템-아이템 재정렬 — 같은 부모(folder_id) 기준.
    const itemOver = items.find((i) => i.id === overId);
    if (itemActive && itemOver && onReorderItems) {
      const parentId = itemActive.folder_id ?? null;
      if ((itemOver.folder_id ?? null) !== parentId) return; // 부모 다르면 순서 변경 취소(이동은 별도 UX)
      // 해당 부모의 item 들을 현재 정렬 기준으로 나열.
      const siblings = items
        .filter((i) => (i.folder_id ?? null) === parentId)
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          const sa = a.sort_order ?? 0;
          const sb = b.sort_order ?? 0;
          if (sa !== sb) return sa - sb;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
      const oldIdx = siblings.findIndex((i) => i.id === activeId);
      const newIdx = siblings.findIndex((i) => i.id === overId);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(siblings, oldIdx, newIdx);
      onReorderItems(reordered.map((i) => i.id), parentId);
    }
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

  // 부모로부터 "방금 만든 폴더" 신호 받으면 즉시 인라인 이름편집 진입.
  useEffect(() => {
    if (!pendingRenameFolderId) return;
    const f = folders.find((x) => x.id === pendingRenameFolderId);
    if (!f) return;
    setRenamingId(pendingRenameFolderId);
    setRenameValue(f.name);
    onConsumeRename?.();
  }, [pendingRenameFolderId, folders, onConsumeRename]);

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

  // Shift 범위선택 기준점. handleLongPress·toggleSelectionWithAnchor 에서 갱신.
  const lastSelRef = useRef<string | null>(null);

  const handleLongPress = useCallback((id: string, type: "folder" | "item") => {
    setSelectMode(true);
    onSelectModeChange?.(true);
    addToSelection(id, type);
    lastSelRef.current = id;
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

  // 마우스 드래그 다중선택 (데스크톱) — 좌클릭 누른 채 움직이면 지나간 항목 누적 선택.
  // 이동 거리 5px 넘어야 발동 → 단일 클릭(열기) 과 충돌 방지.
  const mouseDragRef = useRef<{ startX: number; startY: number; active: boolean } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const s = mouseDragRef.current;
      if (!s) return;
      if (!s.active) {
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        if (dx * dx + dy * dy < 25) return; // 5px 임계값
        s.active = true;
        if (!selectMode) {
          setSelectMode(true);
          onSelectModeChange?.(true);
        }
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const sel = el?.closest("[data-sel-id]") as HTMLElement | null;
      // 즐겨찾기 섹션(data-sel-exclude) 하위 항목은 드래그 선택 대상 제외.
      if (!sel || sel.closest("[data-sel-exclude]")) return;
      addToSelection(sel.dataset.selId!, sel.dataset.selType as "folder" | "item");
    };
    const onUp = () => { mouseDragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [addToSelection, selectMode, onSelectModeChange]);

  // 좌클릭(button 0)만 드래그 시작. 대시보드 컨테이너 onMouseDown 핸들러.
  // preventDefault 로 브라우저 네이티브 text 선택 / HTML5 DnD 차단(금지 커서 방지).
  // 단 button·input·textarea·[contenteditable] 위 클릭은 통과(이름편집 등 정상동작).
  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, textarea, [contenteditable='true']")) return;
    mouseDragRef.current = { startX: e.clientX, startY: e.clientY, active: false };
    e.preventDefault();
  }, []);

  // 빈 영역 클릭 시 선택모드 해제 — 드래그 종료 직후 항목 외 클릭이면 selectMode 종료.
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (!selectMode) return;
    const target = e.target as HTMLElement;
    // 항목·버튼·입력요소 위 클릭은 기존 핸들러가 처리. 그 외(빈 영역) 만 reset.
    if (target.closest("[data-sel-id], button, input, textarea, [contenteditable='true']")) return;
    exitSelect();
  }, [selectMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shift+클릭 범위 선택 — selectMode 이고 shift 누른 채 항목 클릭 시
  // lastSelRef 부터 현재 클릭 항목까지 DOM 순서대로 한 번에 선택.
  const handleContainerClickCapture = useCallback(
    (e: React.MouseEvent) => {
      if (!selectMode || !e.shiftKey) return;
      const el = (e.target as HTMLElement).closest("[data-sel-id]") as HTMLElement | null;
      if (!el) return;
      const clickedId = el.dataset.selId!;
      if (!lastSelRef.current) {
        // 아직 기준점 없으면 현재만 선택 + 기준 기록
        addToSelection(clickedId, el.dataset.selType as "folder" | "item");
        lastSelRef.current = clickedId;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (lastSelRef.current === clickedId) return;
      const containerEl = el.closest("[data-sel-container]");
      const pool: HTMLElement[] = containerEl
        ? (Array.from(containerEl.querySelectorAll("[data-sel-id]")) as HTMLElement[])
        : (Array.from(document.querySelectorAll("[data-sel-id]")) as HTMLElement[]);
      const fromIdx = pool.findIndex((x) => x.dataset.selId === lastSelRef.current);
      const toIdx = pool.findIndex((x) => x.dataset.selId === clickedId);
      if (fromIdx === -1 || toIdx === -1) return;
      e.preventDefault();
      e.stopPropagation();
      const [lo, hi] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
      for (let i = lo; i <= hi; i++) {
        const x = pool[i];
        addToSelection(x.dataset.selId!, x.dataset.selType as "folder" | "item");
      }
      lastSelRef.current = clickedId;
    },
    [selectMode, addToSelection]
  );

  // 일반 토글 발생 시에도 lastSelRef 갱신 — 다음 shift 클릭의 기준점으로.
  const toggleSelectionWithAnchor = useCallback(
    (id: string, type: "folder" | "item") => {
      toggleSelection(id, type);
      lastSelRef.current = id;
    },
    [toggleSelection]
  );

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

      {/* 폴더 이동 — 모바일은 바텀시트, 데스크톱(md+)은 중앙 다이얼로그.
          modal=false 로 외부 요소 터치·포커스 가능 + 외부 터치 시 자동 닫힘. */}
      <Sheet open={moveMode} onOpenChange={setMoveMode} modal={false}>
        <SheetContent side="bottom" className="md:hidden rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)] max-h-[60dvh] z-[65]" showBackButton={false} showCloseButton={false} initialFocus={false} hideOverlay>
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
              <MoveTargetTree folders={folders} excludeIds={selFolders} parentId={null} onSelect={(id) => doMove(id)} />
            </div>
            <div className="px-4 pt-2 shrink-0">
              <Button size="sm" variant="outline" className="w-full h-9" onClick={() => setMoveMode(false)}>취소</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={moveMode} onOpenChange={setMoveMode}>
        <DialogContent className="hidden md:flex md:flex-col max-w-md max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>이동할 폴더 선택</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-0.5 overflow-y-auto flex-1 -mx-4 px-4">
            <button type="button" onClick={() => doMove(null)}
              className="flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent font-medium"><Folder className="h-4 w-4" /> 루트 (최상위)</button>
            <MoveTargetTree folders={folders} excludeIds={selFolders} parentId={null} onSelect={(id) => doMove(id)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setMoveMode(false)}>취소</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div
        className="flex flex-col gap-3 p-4 overflow-y-auto flex-1 w-full md:max-w-xl"
        data-sel-container
        onMouseDown={handleContainerMouseDown}
        onClickCapture={handleContainerClickCapture}
        onClick={handleContainerClick}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* 검색창 자리: 선택모드 시 동일 높이의 선택 툴바로 치환 → 레이아웃 이동 없음.
            꾹 눌러 선택 시 상단 높이가 바뀌지 않아 손가락 아래 항목이 그대로 유지됨. */}
        {selectMode ? (
          <div className="flex h-9 items-center gap-0.5 -mx-1">
            <button type="button" onClick={exitSelect} aria-label="선택 해제" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"><ArrowLeft className="h-[18px] w-[18px]" /></button>
            <span className="flex-1 text-sm font-semibold truncate px-1">{totalSel}개 선택</span>
            {totalSel === 1 && (
              <button type="button" onClick={startInlineRename} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" title="이름 변경" aria-label="이름 변경"><Pencil className="h-[18px] w-[18px]" strokeWidth={1.6} /></button>
            )}
            {totalSel > 0 && (
              <button type="button" onClick={() => setMoveMode(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" title="폴더 이동" aria-label="폴더 이동"><FolderInput className="h-[18px] w-[18px]" strokeWidth={1.6} /></button>
            )}
            <button type="button" onClick={handleDeleteBulk} disabled={totalSel === 0} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent disabled:opacity-30" title="삭제" aria-label="삭제"><Trash2 className="h-[18px] w-[18px] text-destructive" strokeWidth={1.6} /></button>
          </div>
        ) : !hideSearch ? (
          <SearchInput value={searchQuery} onChange={onSearch} placeholder="노트 검색..." size="md" />
        ) : null}

        {searchQuery.trim() && !selectMode ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">{searchResults.length}개 결과</p>
            {searchResults.length === 0 ? (
              <KnowledgeEmptyState variant="no-search-results" query={searchQuery.trim()} />
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
            {/* 즐겨찾기 — 폴더 + 파일 모두. data-sel-exclude 로 드래그 선택 대상에서 제외. */}
            {favoriteItems.length > 0 && (
              <section data-sel-exclude className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-0.5">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> 즐겨찾기
                </h3>
                {/* 즐겨찾기는 글(파일) 전용 — 웹과 통일. 폴더 즐겨찾기 기능 제거. */}
                {favoriteItems.map((item) => (
                  <div
                    key={item.id} role="button" tabIndex={0}
                    onClick={() => onSelectItem(item.id)}
                    className="flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors select-none hover:bg-accent/50"
                  >
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

            {/* 폴더 트리 + 최상위 노트 — 한 섹션 내 하나의 DndContext.
                폴더·아이템 각각 SortableContext 로 분리해 중복 id 충돌 방지. */}
            {(rootFolders.length > 0 || rootItems.length > 0) && (
              <section className="flex flex-col">
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={rootFolders.map((f) => f.id)} strategy={verticalListSortingStrategy}>
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
                  </SortableContext>
                  <SortableContext items={rootItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {rootItems.map((it) => (
                      <SortableNoteRow
                        key={it.id}
                        item={it}
                        depth={0}
                        selectMode={selectMode}
                        selected={selItems.has(it.id)}
                        onToggle={() => toggleSelection(it.id, "item")}
                        onClick={() => (selectMode ? toggleSelection(it.id, "item") : onSelectItem(it.id))}
                        onLongPress={() => handleLongPress(it.id, "item")}
                        renamingId={renamingId}
                        renameValue={renameValue}
                        onRenameChange={setRenameValue}
                        onRenameSubmit={submitRename}
                        isFavorite={it.pinned}
                        onToggleFavorite={
                          onTogglePinItem ? () => onTogglePinItem(it.id, it.pinned) : undefined
                        }
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </section>
            )}

            {favoriteItems.length === 0 && rootFolders.length === 0 && rootItems.length === 0 && !selectMode && !loading && (
              <KnowledgeEmptyState variant="no-folders" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

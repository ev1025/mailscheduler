"use client";

import { useState } from "react";
import { FolderTreeRow, NoteTreeRow } from "@/components/knowledge/knowledge-dashboard";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";

// 노트 편집·읽기 모드에서 왼쪽에 뜨는 탐색기.
// 대시보드의 FolderTreeRow · NoteTreeRow 재사용으로 비주얼 일관성 유지.
// 선택모드·이름변경·즐겨찾기 토글 같은 부가기능은 제외 — 사이드바는 "탐색/이동" 에만 집중.

interface Props {
  folders: KnowledgeFolder[];
  items: KnowledgeItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onSelectFolder?: (id: string) => void;
}

export default function KnowledgeSidebarTree({
  folders,
  items,
  selectedItemId,
  onSelectItem,
  onSelectFolder,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const rootFolders = folders.filter((f) => !f.parent_id);
  const rootItems = items
    .filter((i) => !i.folder_id)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  // selectMode·rename·favorite 미사용 no-op
  const noop = () => {};
  const emptySet = new Set<string>();

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {rootFolders.map((f) => (
        <FolderTreeRow
          key={f.id}
          folder={f}
          allFolders={folders}
          allItems={items}
          depth={0}
          expanded={expanded}
          onToggle={toggleExpand}
          selectMode={false}
          selFolders={emptySet}
          selItems={emptySet}
          onToggleFolder={noop}
          onToggleItem={noop}
          onClickFolder={(id) => onSelectFolder?.(id)}
          onClickItem={onSelectItem}
          onLongPress={noop}
          isFolderFavorite={() => false}
          onToggleFolderFavorite={noop}
        />
      ))}
      {rootItems.map((it) => (
        <NoteTreeRow
          key={it.id}
          item={it}
          depth={0}
          selectMode={false}
          selected={it.id === selectedItemId}
          onToggle={noop}
          onClick={() => onSelectItem(it.id)}
          onLongPress={noop}
          isFavorite={it.pinned}
        />
      ))}
    </div>
  );
}

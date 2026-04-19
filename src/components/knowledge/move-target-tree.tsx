"use client";

import { Folder } from "lucide-react";
import type { KnowledgeFolder } from "@/types";

// 폴더 이동 바텀시트 내부의 "이동할 대상 폴더" 트리.
// dashboard 와 folder-note-list 에서 동일한 로직으로 중복되던 것을 통합.
// 제외할 폴더(이동 대상으로 선택 불가) 는 excludeIds 로 전달.

export interface MoveTargetTreeProps {
  folders: KnowledgeFolder[];
  excludeIds: Set<string>;
  parentId: string | null;
  depth?: number;
  onSelect: (folderId: string) => void;
}

export default function MoveTargetTree({
  folders,
  excludeIds,
  parentId,
  depth = 0,
  onSelect,
}: MoveTargetTreeProps) {
  const children = folders.filter(
    (f) => f.parent_id === parentId && !excludeIds.has(f.id)
  );
  if (children.length === 0) return null;
  return (
    <>
      {children.map((f) => (
        <div key={f.id}>
          <button
            type="button"
            onClick={() => onSelect(f.id)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
            style={{ paddingLeft: (depth + 1) * 16 + 8 }}
          >
            <Folder className="h-3.5 w-3.5 shrink-0" />
            {f.name}
          </button>
          <MoveTargetTree
            folders={folders}
            excludeIds={excludeIds}
            parentId={f.id}
            depth={depth + 1}
            onSelect={onSelect}
          />
        </div>
      ))}
    </>
  );
}

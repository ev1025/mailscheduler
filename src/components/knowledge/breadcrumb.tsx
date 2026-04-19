"use client";

import { Home, ChevronRight } from "lucide-react";
import type { KnowledgeFolder } from "@/types";

// 현재 폴더를 기준으로 루트까지의 경로를 생성.
// ex) [지식창고] › [개발] › [Python]
// 각 경로 항목 클릭 시 해당 폴더로 이동 (onNavigate(null) 이면 홈).

interface Props {
  folder: KnowledgeFolder | null;
  folders: KnowledgeFolder[];
  onNavigate: (folderId: string | null) => void;
  // 노트 상세 화면에서 쓰일 때는 마지막에 노트 제목을 보조로 노출
  trailingLabel?: string;
}

function buildPath(folders: KnowledgeFolder[], leaf: KnowledgeFolder): KnowledgeFolder[] {
  const path: KnowledgeFolder[] = [];
  let current: KnowledgeFolder | undefined = leaf;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = folders.find((f) => f.id === current!.parent_id);
  }
  return path;
}

export default function KnowledgeBreadcrumb({
  folder,
  folders,
  onNavigate,
  trailingLabel,
}: Props) {
  const path = folder ? buildPath(folders, folder) : [];

  return (
    <nav
      className="flex items-center gap-1 text-xs text-muted-foreground min-w-0 overflow-x-auto scrollbar-none"
      aria-label="경로"
    >
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent hover:text-foreground transition-colors shrink-0"
      >
        <Home className="h-3 w-3" />
        <span>지식창고</span>
      </button>
      {path.map((f, idx) => {
        const isLast = idx === path.length - 1 && !trailingLabel;
        return (
          <span key={f.id} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="h-3 w-3" />
            {isLast ? (
              <span className="px-1.5 py-0.5 font-medium text-foreground truncate max-w-[160px]">
                {f.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(f.id)}
                className="px-1.5 py-0.5 rounded hover:bg-accent hover:text-foreground transition-colors truncate max-w-[160px]"
              >
                {f.name}
              </button>
            )}
          </span>
        );
      })}
      {trailingLabel && (
        <span className="flex items-center gap-1 shrink-0">
          <ChevronRight className="h-3 w-3" />
          <span className="px-1.5 py-0.5 font-medium text-foreground truncate max-w-[200px]">
            {trailingLabel}
          </span>
        </span>
      )}
    </nav>
  );
}

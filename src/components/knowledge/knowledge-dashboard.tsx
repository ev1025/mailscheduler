"use client";

import {
  Search,
  Pin,
  Folder,
  FolderOpen,
  Plus,
  FileText,
  ChefHat,
  Code,
  CheckSquare,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { KnowledgeFolder, KnowledgeItem } from "@/types";
import { useState } from "react";

/* ── 노트 템플릿 ── */
export type NoteTemplate = "free" | "recipe" | "cheatsheet" | "checklist";

export const TEMPLATES: { key: NoteTemplate; label: string; icon: typeof FileText; desc: string }[] = [
  { key: "free", label: "자유 노트", icon: FileText, desc: "빈 노트" },
  { key: "recipe", label: "레시피", icon: ChefHat, desc: "재료 · 조리법 · 팁" },
  { key: "cheatsheet", label: "치트시트", icon: Code, desc: "코드/명령어 정리" },
  { key: "checklist", label: "체크리스트", icon: CheckSquare, desc: "할 일 목록" },
];

export function getTemplateContent(t: NoteTemplate): string {
  switch (t) {
    case "recipe":
      return `<h2>재료</h2><ul><li>재료 1</li><li>재료 2</li></ul><h2>조리법</h2><ol><li>1단계</li><li>2단계</li></ol><h2>팁</h2><p></p>`;
    case "cheatsheet":
      return `<h2>기본 명령어</h2><pre><code>명령어 입력</code></pre><h2>자주 쓰는 패턴</h2><pre><code>패턴 입력</code></pre>`;
    case "checklist":
      return `<h2>할 일</h2><ul><li>항목 1</li><li>항목 2</li><li>항목 3</li></ul>`;
    default:
      return "";
  }
}

interface DashboardProps {
  folders: KnowledgeFolder[];
  items: KnowledgeItem[];
  onSelectItem: (id: string) => void;
  onSelectFolder: (folderId: string) => void;
  onAddItem: (folderId: string | null, template?: NoteTemplate) => void;
  onAddFolder: (parentId: string | null) => void;
  onSearch: (q: string) => void;
  searchQuery: string;
  searchResults: KnowledgeItem[];
}

export default function KnowledgeDashboard({
  folders,
  items,
  onSelectItem,
  onSelectFolder,
  onAddItem,
  onAddFolder,
  onSearch,
  searchQuery,
  searchResults,
}: DashboardProps) {
  const pinnedItems = items.filter((i) => i.pinned);
  const [templateOpen, setTemplateOpen] = useState(false);

  // 루트 폴더만 (parent_id=null)
  const rootFolders = folders.filter((f) => !f.parent_id);

  // 폴더별 노트 수
  const folderCounts: Record<string, number> = {};
  for (const item of items) {
    if (item.folder_id) {
      folderCounts[item.folder_id] = (folderCounts[item.folder_id] || 0) + 1;
    }
  }
  // 하위 폴더의 노트 수도 부모에 합산
  for (const f of folders) {
    if (f.parent_id && folderCounts[f.id]) {
      folderCounts[f.parent_id] = (folderCounts[f.parent_id] || 0) + folderCounts[f.id];
    }
  }

  const unfiledCount = items.filter((i) => !i.folder_id).length;

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto h-full">
      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="노트 검색..."
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* 검색 결과 */}
      {searchQuery.trim() ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">검색 결과 {searchResults.length}개</p>
          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">결과 없음</p>
          ) : (
            searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item.id)}
                className="flex flex-col gap-0.5 rounded-lg border p-3 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {item.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                  <span className="text-sm font-medium line-clamp-1">{item.title || "(제목 없음)"}</span>
                </div>
                {item.excerpt && (
                  <span className="text-xs text-muted-foreground line-clamp-1">{item.excerpt}</span>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex gap-1 mt-0.5">
                    {item.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          {/* 📌 고정 노트 */}
          {pinnedItems.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Pin className="h-3 w-3" /> 고정 노트
              </h3>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {pinnedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectItem(item.id)}
                    className="flex min-w-[120px] max-w-[160px] shrink-0 flex-col gap-1 rounded-lg border bg-card p-3 text-left hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-xs font-semibold line-clamp-2">{item.title || "(제목 없음)"}</span>
                    {item.tags && item.tags.length > 0 && (
                      <span className="text-[10px] text-primary truncate">{item.tags.join(" · ")}</span>
                    )}
                    {item.excerpt && (
                      <span className="text-[10px] text-muted-foreground line-clamp-2">{item.excerpt}</span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 📁 폴더 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Folder className="h-3 w-3" /> 폴더
              </h3>
              <button
                type="button"
                onClick={() => onAddFolder(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {rootFolders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectFolder(f.id)}
                  className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-3 text-left hover:bg-accent/50 transition-colors"
                >
                  <span className="text-lg">{f.icon || "📁"}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold truncate">{f.name}</span>
                    <span className="text-[10px] text-muted-foreground">{folderCounts[f.id] || 0}개</span>
                  </div>
                </button>
              ))}
              {unfiledCount > 0 && (
                <button
                  type="button"
                  onClick={() => onSelectFolder("__unfiled__")}
                  className="flex items-center gap-2.5 rounded-lg border border-dashed bg-card px-3 py-3 text-left hover:bg-accent/50 transition-colors"
                >
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold truncate">미분류</span>
                    <span className="text-[10px] text-muted-foreground">{unfiledCount}개</span>
                  </div>
                </button>
              )}
            </div>
          </section>

          {/* 새 노트 만들기 (템플릿) */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">새 노트 만들기</h3>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(({ key, label, icon: Icon, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onAddItem(null, key)}
                  className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-[10px] text-muted-foreground">{desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

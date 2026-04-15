"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Pin,
  Folder,
  FileText,
  Archive,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useKnowledgeFolders } from "@/hooks/use-knowledge-folders";
import {
  useKnowledgeItems,
  searchKnowledge,
} from "@/hooks/use-knowledge-items";
import KnowledgeTree from "@/components/knowledge/knowledge-tree";
import RichEditor from "@/components/knowledge/rich-editor";
import type { KnowledgeItem } from "@/types";
import { toast } from "sonner";
import { sanitizeRichHTML } from "@/lib/sanitize";
import PageHeader from "@/components/layout/page-header";
import PromptDialog from "@/components/ui/prompt-dialog";

// --- 임시저장 (localStorage) ---
const DRAFTS_KEY = "knowledge_drafts";

interface Draft {
  id: string;
  source_id: string | null; // 수정 중이던 노트 id (신규면 null)
  folder_id: string | null;
  title: string;
  content: string;
  savedAt: string;
  auto?: boolean; // true면 자동 임시저장 (idle 10초 후)
}

function loadDrafts(): Draft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveDrafts(drafts: Draft[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.slice(0, 20)));
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={null}>
      <KnowledgePageInner />
    </Suspense>
  );
}

function KnowledgePageInner() {
  const {
    folders,
    addFolder,
    updateFolder,
    deleteFolder,
  } = useKnowledgeFolders();

  // 모든 노트 (폴더 필터 없이, 트리에서 그룹핑)
  const { items, addItem, updateItem, deleteItem, refetch } =
    useKnowledgeItems(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const urlItemId = searchParams.get("item");
  const [selectedItemId, _setSelectedItemId] = useState<string | null>(urlItemId);
  const setSelectedItemId = (id: string | null) => {
    _setSelectedItemId(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("item", id);
    else params.delete("item");
    const qs = params.toString();
    router.replace(qs ? `/knowledge?${qs}` : "/knowledge", { scroll: false });
  };
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [dirty, setDirty] = useState(false);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeItem[]>([]);
  const [mobileSidebar, setMobileSidebar] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [folderPromptOpen, setFolderPromptOpen] = useState(false);
  const [folderPromptParentId, setFolderPromptParentId] = useState<string | null>(null);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(loadDrafts());
  }, []);

  const selectedItem = useMemo(
    () =>
      items.find((i) => i.id === selectedItemId) ||
      searchResults.find((i) => i.id === selectedItemId) ||
      null,
    [items, searchResults, selectedItemId]
  );

  // 10초 idle 자동 임시저장: source_id 기준으로 한 건만 유지 (덮어쓰기).
  useEffect(() => {
    if (!dirty) return;
    if (!editTitle.trim() && !editContent.trim()) return;
    const timer = setTimeout(() => {
      const key = selectedItem?.id ?? "__new__";
      const now = new Date().toISOString();
      const entry: Draft = {
        id: `auto_${key}`,
        source_id: selectedItem?.id ?? null,
        folder_id: selectedItem?.folder_id ?? null,
        title: editTitle || "(제목 없음)",
        content: editContent,
        savedAt: now,
        auto: true,
      };
      setDrafts((prev) => {
        const next = [entry, ...prev.filter((d) => d.id !== entry.id)];
        saveDrafts(next);
        return next;
      });
      setAutoSavedAt(now);
    }, 10000);
    return () => clearTimeout(timer);
  }, [editTitle, editContent, dirty, selectedItem?.id, selectedItem?.folder_id]);

  useEffect(() => {
    if (selectedItem) {
      setEditTitle(selectedItem.title);
      setEditContent(selectedItem.content || "");
      setDirty(false);
    } else {
      setEditTitle("");
      setEditContent("");
    }
  }, [selectedItem?.id]);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await searchKnowledge(search);
      setSearchResults(r);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleAddFolder = (parentId: string | null) => {
    setFolderPromptParentId(parentId);
    setFolderPromptOpen(true);
  };

  const handleAddItem = async (folderId: string | null) => {
    const { data } = await addItem({
      folder_id: folderId,
      title: "",
      content: "",
      excerpt: null,
      tags: null,
      pinned: false,
      type: "note",
      url: null,
    });
    if (data) {
      setSelectedItemId(data.id);
      setMobileSidebar(false);
    }
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    await updateItem(selectedItem.id, {
      title: editTitle,
      content: sanitizeRichHTML(editContent),
    });
    setDirty(false);
  };

  const handleSaveDraft = () => {
    if (!editTitle.trim() && !editContent.trim()) {
      toast.error("내용이 비어있습니다");
      return;
    }
    const draft: Draft = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      source_id: selectedItem?.id || null,
      folder_id: selectedItem?.folder_id || null,
      title: editTitle || "(제목 없음)",
      content: editContent,
      savedAt: new Date().toISOString(),
    };
    const next = [draft, ...drafts];
    saveDrafts(next);
    setDrafts(next);
  };

  const handleLoadDraft = (d: Draft) => {
    if (dirty && !confirm("작성 중인 내용이 사라집니다. 계속할까요?")) return;
    if (d.source_id) {
      // 기존 노트 수정본
      setSelectedItemId(d.source_id);
      // 비동기 로드 후 덮어쓰기 위해 타이밍 우회
      setTimeout(() => {
        setEditTitle(d.title);
        setEditContent(d.content);
        setDirty(true);
      }, 50);
    } else {
      // 신규 임시저장본 → 바로 새 노트 만들고 채우기
      addItem({
        folder_id: d.folder_id,
        title: d.title,
        content: d.content,
        excerpt: null,
        tags: null,
        pinned: false,
        type: "note",
        url: null,
      }).then(({ data }) => {
        if (data) {
          setSelectedItemId(data.id);
          setEditTitle(d.title);
          setEditContent(d.content);
        }
      });
    }
    setDraftsOpen(false);
  };

  const handleDeleteDraft = (id: string) => {
    const next = drafts.filter((d) => d.id !== id);
    saveDrafts(next);
    setDrafts(next);
  };

  const handleDelete = async (id: string) => {
    await deleteItem(id);
    if (selectedItemId === id) setSelectedItemId(null);
  };


  const moveFolder = async (id: string, newParentId: string | null) => {
    await updateFolder(id, { parent_id: newParentId });
  };

  const moveItem = async (id: string, newFolderId: string | null) => {
    await updateItem(id, { folder_id: newFolderId });
  };

  const renameFolder = async (id: string, name: string) => {
    await updateFolder(id, { name });
  };

  const showingSearch = search.trim().length > 0;

  const editorOpen = !!selectedItem && !mobileSidebar;

  const editorActions = (
    <div className="flex items-center gap-2">
      {autoSavedAt && (
        <span
          className="text-[11px] text-muted-foreground whitespace-nowrap"
          title="10초 이상 입력이 없으면 자동으로 임시저장됩니다"
        >
          자동저장 {new Date(autoSavedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
      <Popover open={draftsOpen} onOpenChange={setDraftsOpen}>
        <PopoverTrigger
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
          title="임시저장 목록"
          aria-label="임시저장 목록"
        >
          <Archive className="h-5 w-5" strokeWidth={1.6} />
          {drafts.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
              {drafts.length}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0 max-h-80 overflow-y-auto" align="end">
          <div className="p-2 border-b flex items-center justify-between">
            <span className="text-xs font-semibold">
              임시저장 ({drafts.length})
            </span>
          </div>
          {drafts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              임시저장된 글이 없습니다
            </p>
          ) : (
            <div className="flex flex-col">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="group flex items-start gap-2 border-b p-2 hover:bg-accent cursor-pointer"
                  onClick={() => handleLoadDraft(d)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-1">{d.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(d.savedAt).toLocaleString("ko-KR", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {d.source_id ? " · 수정본" : " · 신규"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="p-0.5 text-muted-foreground/60 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDraft(d.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
      <Button size="sm" variant="outline" onClick={handleSaveDraft} className="h-8 text-xs">
        임시저장
      </Button>
      <Button size="sm" onClick={handleSave} disabled={!dirty} className="h-8 text-xs">
        저장
      </Button>
    </div>
  );

  const listActions = (
    <>
      <button
        type="button"
        onClick={() => handleAddFolder(null)}
        aria-label="폴더 추가"
        title="폴더 추가"
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
      >
        <Folder className="h-[20px] w-[20px]" strokeWidth={1.6} />
      </button>
      <button
        type="button"
        onClick={() => handleAddItem(null)}
        aria-label="새 노트"
        title="새 노트"
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
      >
        <FileText className="h-[20px] w-[20px]" strokeWidth={1.6} />
      </button>
    </>
  );

  return (
    <>
      <PageHeader
        title="지식창고"
        actions={editorOpen ? editorActions : listActions}
        showBell={!editorOpen}
      />
    <div className="flex h-[calc(100dvh-3.5rem-3.5rem)] md:h-[calc(100dvh-3.5rem)]">
      {/* 왼쪽: 트리 */}
      <aside
        className={`${
          mobileSidebar ? "flex" : "hidden md:flex"
        } flex-col w-full md:w-64 border-r overflow-hidden`}
      >
        <div className="p-3 border-b flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색"
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {showingSearch ? (
            <div className="flex flex-col gap-0.5">
              <p className="text-xs text-muted-foreground px-1 mb-1">
                검색 결과 {searchResults.length}개
              </p>
              {searchResults.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  결과 없음
                </p>
              ) : (
                searchResults.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => {
                      setSelectedItemId(i.id);
                      setMobileSidebar(false);
                    }}
                    className={`flex flex-col gap-0.5 p-2 text-left rounded-md hover:bg-accent transition-colors ${
                      selectedItemId === i.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {i.pinned && (
                        <Pin className="h-3 w-3 text-primary" />
                      )}
                      <span className="text-sm font-medium line-clamp-1">
                        {i.title}
                      </span>
                    </div>
                    {i.excerpt && (
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {i.excerpt}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : (
            <KnowledgeTree
              folders={folders}
              items={items}
              selectedItemId={selectedItemId}
              onSelectItem={(id) => {
                setSelectedItemId(id);
                setMobileSidebar(false);
              }}
              onAddFolder={handleAddFolder}
              onAddItem={handleAddItem}
              onRenameFolder={renameFolder}
              onDeleteFolder={(id) => {
                deleteFolder(id);
                refetch();
              }}
              onDeleteItem={handleDelete}
              onMoveFolder={moveFolder}
              onMoveItem={moveItem}
            />
          )}
        </div>
      </aside>

      {/* 오른쪽: 에디터 */}
      <main
        className={`${
          mobileSidebar ? "hidden md:flex" : "flex"
        } flex-1 flex-col overflow-hidden`}
      >
        {selectedItem ? (
          <>
            <div className="border-b flex flex-col">
              {/* 1행: 뒤로 + 제목 + 핀 */}
              <div className="flex items-center gap-2 px-2 md:px-3 pt-2 pb-1">
                <button
                  type="button"
                  onClick={() => setMobileSidebar(true)}
                  className="md:hidden shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="목록"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Input
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value);
                    setDirty(true);
                  }}
                  className="flex-1 h-8 text-sm md:text-base font-semibold border-none bg-transparent focus-visible:ring-0 px-1 min-w-0 placeholder:text-muted-foreground/50 placeholder:font-normal"
                  placeholder="새 노트 제목..."
                />
              </div>

            </div>
            <div className="flex-1 overflow-hidden">
              <RichEditor
                key={selectedItem.id}
                content={editContent}
                onChange={(html) => {
                  setEditContent(html);
                  setDirty(true);
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <div className="text-center flex flex-col items-center gap-2 px-4">
              <FileText className="h-12 w-12 opacity-20" />
              <p className="font-medium">노트를 선택하거나 새로 만들어보세요</p>
              <p className="text-xs">
                왼쪽 트리에서 폴더를 만들고 노트를 드래그해서 이동할 수 있어요
              </p>
              <Button
                onClick={() => handleAddItem(null)}
                size="sm"
                className="mt-2"
              >
                <Plus className="mr-1 h-3 w-3" /> 새 노트
              </Button>
            </div>
          </div>
        )}
      </main>
      <PromptDialog
        open={folderPromptOpen}
        onOpenChange={setFolderPromptOpen}
        title="새 폴더 만들기"
        placeholder="폴더 이름"
        confirmLabel="만들기"
        onConfirm={async (name) => {
          await addFolder(name, undefined, folderPromptParentId);
        }}
      />
    </div>
    </>
  );
}

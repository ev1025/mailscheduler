"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  Pin,
  Save,
  Folder,
  FileText,
  Archive,
  Trash2,
  X,
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

// --- 임시저장 (localStorage) ---
const DRAFTS_KEY = "knowledge_drafts";

interface Draft {
  id: string;
  source_id: string | null; // 수정 중이던 노트 id (신규면 null)
  folder_id: string | null;
  title: string;
  content: string;
  savedAt: string;
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
  const {
    folders,
    addFolder,
    updateFolder,
    deleteFolder,
  } = useKnowledgeFolders();

  // 모든 노트 (폴더 필터 없이, 트리에서 그룹핑)
  const { items, addItem, updateItem, deleteItem, refetch } =
    useKnowledgeItems(null);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [dirty, setDirty] = useState(false);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeItem[]>([]);
  const [mobileSidebar, setMobileSidebar] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);

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

  const handleAddFolder = async (parentId: string | null) => {
    const name = prompt("새 폴더 이름:");
    if (!name || !name.trim()) return;
    await addFolder(name.trim(), undefined, parentId);
  };

  const handleAddItem = async (folderId: string | null) => {
    const { data } = await addItem({
      folder_id: folderId,
      title: "새 노트",
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
      content: editContent,
    });
    setDirty(false);
    toast.success("저장되었습니다");
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
    toast.success("임시저장됨");
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

  const togglePin = async () => {
    if (!selectedItem) return;
    await updateItem(selectedItem.id, { pinned: !selectedItem.pinned });
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

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-dvh">
      {/* 왼쪽: 트리 */}
      <aside
        className={`${
          mobileSidebar ? "flex" : "hidden md:flex"
        } flex-col w-full md:w-64 border-r overflow-hidden`}
      >
        <div className="p-3 border-b flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">지식창고</h2>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAddFolder(null)}
                className="h-7 px-2 text-xs"
                title="최상위 폴더 추가"
              >
                <Folder className="h-3 w-3 mr-1" />+
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAddItem(null)}
                className="h-7 px-2 text-xs"
                title="노트 추가"
              >
                <FileText className="h-3 w-3 mr-1" />+
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색"
              className="pl-7 h-7 text-xs"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {showingSearch ? (
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] text-muted-foreground px-1 mb-1">
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
                        <Pin className="h-2.5 w-2.5 text-primary" />
                      )}
                      <span className="text-xs font-medium line-clamp-1">
                        {i.title}
                      </span>
                    </div>
                    {i.excerpt && (
                      <span className="text-[10px] text-muted-foreground line-clamp-2">
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
            <div className="p-2 md:p-3 border-b flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileSidebar(true)}
                className="md:hidden text-muted-foreground hover:text-foreground px-2"
              >
                ← 목록
              </button>
              <Input
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  setDirty(true);
                }}
                className="flex-1 h-8 text-sm font-semibold border-none bg-transparent focus-visible:ring-0 px-2"
                placeholder="제목"
              />
              <button
                type="button"
                onClick={togglePin}
                className={`p-1.5 rounded hover:bg-accent ${
                  selectedItem.pinned
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
                title="핀 고정"
              >
                <Pin className="h-3.5 w-3.5" />
              </button>

              {/* 임시저장 드롭다운 */}
              <Popover open={draftsOpen} onOpenChange={setDraftsOpen}>
                <PopoverTrigger
                  className="relative p-1.5 rounded hover:bg-accent text-muted-foreground"
                  title="임시저장 목록"
                >
                  <Archive className="h-3.5 w-3.5" />
                  {drafts.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground">
                      {drafts.length}
                    </span>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0 max-h-80 overflow-y-auto" align="end">
                  <div className="p-2 border-b flex items-center justify-between">
                    <span className="text-xs font-semibold">임시저장 ({drafts.length})</span>
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
                            <p className="text-xs font-medium line-clamp-1">
                              {d.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
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
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive"
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

              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveDraft}
                className="h-7 text-xs"
                title="임시저장"
              >
                임시저장
              </Button>

              {dirty && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="h-7 text-xs"
                >
                  <Save className="mr-1 h-3 w-3" /> 저장
                </Button>
              )}
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
    </div>
  );
}

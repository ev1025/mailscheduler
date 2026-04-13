"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Folder,
  FileText,
  Pin,
  Trash2,
  Search,
  ChevronRight,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useKnowledgeFolders } from "@/hooks/use-knowledge-folders";
import { useKnowledgeItems, searchKnowledge } from "@/hooks/use-knowledge-items";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import type { KnowledgeItem } from "@/types";
import { toast } from "sonner";

export default function KnowledgePage() {
  const { folders, addFolder, deleteFolder } = useKnowledgeFolders();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const { items, addItem, updateItem, deleteItem } =
    useKnowledgeItems(selectedFolderId);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(true);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeItem[]>([]);

  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) ||
      searchResults.find((i) => i.id === selectedItemId) ||
      null,
    [items, searchResults, selectedItemId]
  );

  useEffect(() => {
    if (selectedItem) {
      setEditTitle(selectedItem.title);
      setEditContent(selectedItem.content || "");
      setEditing(false);
    } else {
      setEditTitle("");
      setEditContent("");
    }
  }, [selectedItem]);

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

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return;
    await addFolder(newFolderName.trim());
    setNewFolderName("");
    setAddingFolder(false);
  };

  const handleAddItem = async () => {
    const { data } = await addItem({
      folder_id: selectedFolderId,
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
      setEditing(true);
      setPreview(false);
    }
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    await updateItem(selectedItem.id, {
      title: editTitle,
      content: editContent,
    });
    setEditing(false);
    toast.success("저장되었습니다");
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    if (!confirm(`"${selectedItem.title}" 삭제할까요?`)) return;
    await deleteItem(selectedItem.id);
    setSelectedItemId(null);
  };

  const togglePin = async () => {
    if (!selectedItem) return;
    await updateItem(selectedItem.id, { pinned: !selectedItem.pinned });
  };

  const showList = search.trim() ? searchResults : items;

  return (
    <div className="flex h-[calc(100dvh-3rem)] md:h-dvh">
      {/* 왼쪽 사이드바: 폴더 트리 */}
      <div className="w-48 border-r flex flex-col overflow-hidden">
        <div className="p-3 border-b">
          <h2 className="text-sm font-bold mb-2">지식창고</h2>
          {addingFolder ? (
            <div className="flex gap-1">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="폴더명"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddFolder();
                  if (e.key === "Escape") setAddingFolder(false);
                }}
                className="h-7 text-xs"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingFolder(true)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> 폴더
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => setSelectedFolderId(null)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors ${
              selectedFolderId === null ? "bg-accent font-medium" : ""
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            전체 노트
          </button>
          {folders.map((f) => (
            <div
              key={f.id}
              className={`group flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors cursor-pointer ${
                selectedFolderId === f.id ? "bg-accent font-medium" : ""
              }`}
              onClick={() => setSelectedFolderId(f.id)}
            >
              <Folder className="h-3.5 w-3.5" />
              <span className="flex-1 truncate">{f.name}</span>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`"${f.name}" 폴더 삭제?`)) deleteFolder(f.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 가운데: 항목 리스트 */}
      <div className="w-64 border-r flex flex-col overflow-hidden">
        <div className="p-3 border-b flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="전문 검색"
              className="pl-7 h-7 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddItem}
            className="w-full h-7 text-xs"
          >
            <Plus className="mr-1 h-3 w-3" /> 새 노트
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {showList.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {search.trim() ? "검색 결과 없음" : "노트 없음"}
            </p>
          ) : (
            showList.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setSelectedItemId(i.id)}
                className={`w-full flex flex-col gap-0.5 px-3 py-2 text-left border-b hover:bg-accent transition-colors ${
                  selectedItemId === i.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-center gap-1">
                  {i.pinned && <Pin className="h-2.5 w-2.5 text-primary" />}
                  <span className="text-xs font-medium line-clamp-1 flex-1">
                    {i.title}
                  </span>
                </div>
                {i.excerpt && (
                  <span className="text-[10px] text-muted-foreground line-clamp-2">
                    {i.excerpt}
                  </span>
                )}
                <span className="text-[9px] text-muted-foreground">
                  {new Date(i.updated_at).toLocaleDateString("ko")}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 오른쪽: 에디터/프리뷰 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedItem ? (
          <>
            <div className="p-3 border-b flex items-center gap-2">
              <Input
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  setEditing(true);
                }}
                className="flex-1 h-8 text-sm font-semibold border-none bg-transparent focus-visible:ring-0 px-2"
                placeholder="제목"
              />
              <Button
                size="sm"
                variant={preview ? "outline" : "default"}
                onClick={() => setPreview(!preview)}
                className="h-7 text-xs"
              >
                {preview ? "편집" : "미리보기"}
              </Button>
              <button
                type="button"
                onClick={togglePin}
                className={`p-1.5 rounded hover:bg-accent ${
                  selectedItem.pinned ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
              {editing && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="h-7 text-xs"
                >
                  <Save className="mr-1 h-3 w-3" /> 저장
                </Button>
              )}
              <button
                type="button"
                onClick={handleDeleteItem}
                className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-accent"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {preview ? (
                <article className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {editContent || "_(내용 없음)_"}
                  </ReactMarkdown>
                </article>
              ) : (
                <Textarea
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    setEditing(true);
                  }}
                  placeholder="마크다운으로 작성... (**굵게**, *기울임*, `코드`, ```python 블록```, - 목록, [링크](url))"
                  className="w-full h-full min-h-[60vh] font-mono text-xs resize-none border-none focus-visible:ring-0"
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <div className="text-center flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 opacity-30" />
              <p>왼쪽에서 노트를 선택하거나</p>
              <p>+ 새 노트로 시작하세요</p>
              <ChevronRight className="h-4 w-4 opacity-30" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

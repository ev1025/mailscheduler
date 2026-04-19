"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { FolderPlus, FilePlus } from "lucide-react";
import { useKnowledgeFolders } from "@/hooks/use-knowledge-folders";
import {
  useKnowledgeItems,
  searchKnowledge,
} from "@/hooks/use-knowledge-items";
import { useKnowledgeRouter } from "@/hooks/use-knowledge-router";
import { useKnowledgeDrafts, type KnowledgeDraft } from "@/hooks/use-knowledge-drafts";
import KnowledgeDashboard from "@/components/knowledge/knowledge-dashboard";
import FolderNoteList from "@/components/knowledge/folder-note-list";
import NoteEditorView from "@/components/knowledge/note-editor-view";
import NoteReaderView from "@/components/knowledge/note-reader-view";
import type { KnowledgeItem } from "@/types";
import { toast } from "sonner";
import { sanitizeRichHTML } from "@/lib/sanitize";
import PageHeader from "@/components/layout/page-header";
import PromptDialog from "@/components/ui/prompt-dialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";

export default function KnowledgePage() {
  return (
    <Suspense fallback={null}>
      <KnowledgePageInner />
    </Suspense>
  );
}

function KnowledgePageInner() {
  const { folders, addFolder, updateFolder, deleteFolder } = useKnowledgeFolders();
  const { items, addItem, updateItem, deleteItem, refetch } =
    useKnowledgeItems(null);

  const {
    selectedItemId,
    viewFolderId,
    setSelectedItemId,
    setViewFolderId,
    _setSelectedItemIdDirect,
  } = useKnowledgeRouter();

  const {
    drafts,
    autoSavedAt,
    saveDraft,
    deleteDraft,
    armAutoSave,
  } = useKnowledgeDrafts();

  // ── 편집 상태 ────────────────────────────────────────
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dashSelectMode, setDashSelectMode] = useState(false);
  const [folderSelectMode, setFolderSelectMode] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [folderPromptOpen, setFolderPromptOpen] = useState(false);
  const [folderPromptParentId, setFolderPromptParentId] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<KnowledgeDraft | null>(null);

  // ── 검색 ────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeItem[]>([]);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchResults(await searchKnowledge(search));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const selectedItem = useMemo(
    () =>
      items.find((i) => i.id === selectedItemId) ||
      searchResults.find((i) => i.id === selectedItemId) ||
      null,
    [items, searchResults, selectedItemId]
  );

  // ── 자동 임시저장 (60초 idle) ───────────────────────
  useEffect(() => {
    if (!dirty) return;
    return armAutoSave({
      title: editTitle,
      content: editContent,
      source_id: selectedItem?.id ?? null,
      folder_id: selectedItem?.folder_id ?? null,
      enabled: true,
    });
  }, [editTitle, editContent, dirty, selectedItem?.id, selectedItem?.folder_id, armAutoSave]);

  // 선택된 노트 변경 시 편집 state 초기화
  useEffect(() => {
    if (selectedItem) {
      setEditTitle(selectedItem.title);
      setEditContent(selectedItem.content || "");
      setDirty(false);
      setEditing(!selectedItem.content && !selectedItem.title);
    } else {
      setEditTitle("");
      setEditContent("");
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem?.id]);

  // ── 액션 핸들러 ─────────────────────────────────────
  const handleAddFolder = async (parentId: string | null) => {
    await addFolder("새 폴더", undefined, parentId);
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
      setEditing(true);
    }
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    await updateItem(selectedItem.id, {
      title: editTitle,
      content: sanitizeRichHTML(editContent),
    });
    setDirty(false);
    setEditing(false);
  };

  const handleSaveDraft = () => {
    if (!editTitle.trim() && !editContent.trim()) {
      toast.error("내용이 비어있습니다");
      return;
    }
    saveDraft({
      source_id: selectedItem?.id ?? null,
      folder_id: selectedItem?.folder_id ?? null,
      title: editTitle || "(제목 없음)",
      content: editContent,
    });
  };

  const handleLoadDraft = (d: KnowledgeDraft) => {
    if (dirty) {
      setPendingDraft(d);
      return;
    }
    performLoadDraft(d);
  };

  const performLoadDraft = (d: KnowledgeDraft) => {
    if (d.source_id) {
      setSelectedItemId(d.source_id);
      setTimeout(() => {
        setEditTitle(d.title);
        setEditContent(d.content);
        setDirty(true);
      }, 50);
    } else {
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
          _setSelectedItemIdDirect(data.id);
          setEditTitle(d.title);
          setEditContent(d.content);
        }
      });
    }
    setDraftsOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteItem(id);
    if (selectedItemId === id) setSelectedItemId(null);
  };

  const noteOpen = !!selectedItem;

  const listActions = (
    <>
      <button
        type="button"
        onClick={() => handleAddFolder(viewFolderId)}
        aria-label="폴더 추가"
        title="폴더 추가"
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
      >
        <FolderPlus className="h-[20px] w-[20px]" strokeWidth={1.6} />
      </button>
      <button
        type="button"
        onClick={() => handleAddItem(viewFolderId)}
        aria-label="새 노트"
        title="새 노트"
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
      >
        <FilePlus className="h-[20px] w-[20px]" strokeWidth={1.6} />
      </button>
    </>
  );

  return (
    <>
      {!noteOpen && !dashSelectMode && !folderSelectMode && (
        <PageHeader title="지식창고" actions={listActions} />
      )}
      <div
        className={`flex min-h-0 ${
          noteOpen || dashSelectMode || folderSelectMode
            ? "h-full"
            : "h-[calc(100%-3.5rem)]"
        }`}
      >
        <main className="flex flex-1 flex-col overflow-hidden">
          {selectedItem ? (
            editing ? (
              <NoteEditorView
                item={selectedItem}
                title={editTitle}
                onTitleChange={(v) => {
                  setEditTitle(v);
                  setDirty(true);
                }}
                onContentChange={(html) => {
                  setEditContent(html);
                  setDirty(true);
                }}
                onSave={handleSave}
                onSaveDraft={handleSaveDraft}
                onExit={() => setEditing(false)}
                dirty={dirty}
                autoSavedAt={autoSavedAt}
                drafts={drafts}
                onLoadDraft={handleLoadDraft}
                onDeleteDraft={deleteDraft}
                draftsOpen={draftsOpen}
                onDraftsOpenChange={setDraftsOpen}
              />
            ) : (
              <NoteReaderView
                item={selectedItem}
                onEdit={() => setEditing(true)}
                onExit={() => {
                  setSelectedItemId(null);
                  setViewFolderId(null);
                }}
              />
            )
          ) : viewFolderId ? (
            <FolderNoteList
              folder={
                viewFolderId === "__unfiled__"
                  ? null
                  : folders.find((f) => f.id === viewFolderId) || null
              }
              folders={folders}
              items={items}
              onSelectItem={(id) => setSelectedItemId(id)}
              onSelectFolder={(fid) => setViewFolderId(fid)}
              onBack={() => {
                const current = folders.find((f) => f.id === viewFolderId);
                if (current?.parent_id) setViewFolderId(current.parent_id);
                else setViewFolderId(null);
              }}
              onNavigateToFolder={(fid) => setViewFolderId(fid)}
              onDeleteItems={async (ids) => {
                for (const id of ids) await handleDelete(id);
              }}
              onDeleteFolders={async (ids) => {
                for (const id of ids) deleteFolder(id);
                refetch();
              }}
              onRenameFolder={async (id, name) => {
                await updateFolder(id, { name });
              }}
              onRenameItem={async (id, title) => {
                await updateItem(id, { title });
              }}
              onMoveItems={async (ids, targetFolderId) => {
                for (const id of ids) await updateItem(id, { folder_id: targetFolderId });
              }}
              onMoveFolders={async (ids, targetFolderId) => {
                for (const id of ids) await updateFolder(id, { parent_id: targetFolderId });
              }}
              onSelectModeChange={setFolderSelectMode}
              onTogglePinItem={async (id, pinned) => {
                await updateItem(id, { pinned: !pinned });
              }}
            />
          ) : (
            <KnowledgeDashboard
              folders={folders}
              items={items}
              onSelectItem={(id) => setSelectedItemId(id)}
              onSelectFolder={(fid) => setViewFolderId(fid)}
              onSearch={setSearch}
              searchQuery={search}
              searchResults={searchResults}
              onDeleteItems={async (ids) => {
                for (const id of ids) await handleDelete(id);
              }}
              onDeleteFolders={async (ids) => {
                for (const id of ids) deleteFolder(id);
                refetch();
              }}
              onRenameFolder={async (id, name) => {
                await updateFolder(id, { name });
              }}
              onRenameItem={async (id, title) => {
                await updateItem(id, { title });
              }}
              onReorderFolders={async (ids) => {
                for (let i = 0; i < ids.length; i++) await updateFolder(ids[i], { sort_order: i });
              }}
              onSelectModeChange={setDashSelectMode}
              onMoveItems={async (ids, targetFolderId) => {
                for (const id of ids) await updateItem(id, { folder_id: targetFolderId });
              }}
              onMoveFolders={async (ids, targetFolderId) => {
                for (const id of ids) await updateFolder(id, { parent_id: targetFolderId });
              }}
              onTogglePinItem={async (id, pinned) => {
                await updateItem(id, { pinned: !pinned });
              }}
            />
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

        <ConfirmDialog
          open={!!pendingDraft}
          onOpenChange={(o) => {
            if (!o) setPendingDraft(null);
          }}
          title="작성 중인 내용"
          description="작성 중인 내용이 사라집니다. 계속할까요?"
          confirmLabel="불러오기"
          destructive
          onConfirm={async () => {
            if (pendingDraft) performLoadDraft(pendingDraft);
            setPendingDraft(null);
          }}
        />
      </div>
    </>
  );
}

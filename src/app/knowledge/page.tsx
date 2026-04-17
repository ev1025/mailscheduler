"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  FileText,
  FolderPlus,
  FilePlus,
  Archive,
  Trash2,
  ArrowLeft,
  Pencil,
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
import RichEditor from "@/components/knowledge/rich-editor";
import KnowledgeDashboard from "@/components/knowledge/knowledge-dashboard";
import FolderNoteList from "@/components/knowledge/folder-note-list";
import type { KnowledgeItem } from "@/types";
import { toast } from "sonner";
import { sanitizeRichHTML } from "@/lib/sanitize";
import PageHeader from "@/components/layout/page-header";
import PromptDialog from "@/components/ui/prompt-dialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";

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
  const urlFolderId = searchParams.get("folder");

  const [selectedItemId, _setSelectedItemId] = useState<string | null>(urlItemId);
  const [viewFolderId, _setViewFolderId] = useState<string | null>(urlFolderId);

  // URL 기반 상태 관리 — push로 히스토리 쌓아 뒤로가기가 지식창고 내부에서 동작
  const updateUrl = (item: string | null, folder: string | null, push = true) => {
    const params = new URLSearchParams();
    if (item) params.set("item", item);
    if (folder) params.set("folder", folder);
    const qs = params.toString();
    const url = qs ? `/knowledge?${qs}` : "/knowledge";
    if (push) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  };

  const setSelectedItemId = (id: string | null) => {
    _setSelectedItemId(id);
    _setViewFolderId(null);
    updateUrl(id, null, !!id);
  };

  const setViewFolderId = (fid: string | null) => {
    _setViewFolderId(fid);
    _setSelectedItemId(null);
    updateUrl(null, fid, !!fid);
  };

  // URL 변경 감지 (뒤로가기 시 state 동기화)
  useEffect(() => {
    _setSelectedItemId(searchParams.get("item"));
    _setViewFolderId(searchParams.get("folder"));
  }, [searchParams]);

  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeItem[]>([]);
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

  // 60초 idle 자동 임시저장. 빈 내용(공백/줄바꿈만)은 저장하지 않음.
  useEffect(() => {
    if (!dirty) return;
    // HTML 태그 제거 후 실제 텍스트가 있는지 확인
    const textOnly = editContent.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!editTitle.trim() && !textOnly) return;
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
    }, 60000);
    return () => clearTimeout(timer);
  }, [editTitle, editContent, dirty, selectedItem?.id, selectedItem?.folder_id]);

  // selectedItem이 바뀌면 편집 state를 초기화.
  // editTitle/editContent는 onChange 콜백이 누적한 "미저장 편집 상태"이고,
  // RichEditor는 key={selectedItem.id}로 리마운트되므로 초기 content는
  // selectedItem.content(DB 값)를 직접 넘겨야 함.
  useEffect(() => {
    if (selectedItem) {
      setEditTitle(selectedItem.title);
      setEditContent(selectedItem.content || "");
      setDirty(false);
      // 기존 노트 선택 시 읽기 모드로 시작 (내용 없으면 바로 편집)
      setEditing(!selectedItem.content && !selectedItem.title);
    } else {
      setEditTitle("");
      setEditContent("");
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // 팝업 없이 바로 생성 + 이름은 "새 폴더"로 — 대시보드에서 인라인 수정 가능
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
      setViewFolderId(null);
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
    setEditing(false); // 저장 후 읽기 모드로
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

  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);

  const handleLoadDraft = (d: Draft) => {
    if (dirty) {
      setPendingDraft(d);
      return;
    }
    performLoadDraft(d);
  };

  const performLoadDraft = (d: Draft) => {
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

  const noteOpen = !!selectedItem;
  const editorOpen = noteOpen && editing;

  const draftsPopover = (
    <Popover open={draftsOpen} onOpenChange={setDraftsOpen}>
      <PopoverTrigger
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
        title="임시저장 목록"
        aria-label="임시저장 목록"
      >
        <Archive className="h-[22px] w-[22px]" strokeWidth={1.6} />
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
  );

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
      {/* 노트 열려있으면 PageHeader 숨김, 대시보드/폴더에서는 표시 */}
      {!noteOpen && (
        <PageHeader
          title="지식창고"
          actions={listActions}
        />
      )}
    <div
      className={`flex min-h-0 ${
        noteOpen ? "h-full" : "h-[calc(100%-3.5rem)]"
      }`}
    >
      <main className="flex flex-1 flex-col overflow-hidden">
        {selectedItem ? (
          editing ? (
            /* ── 편집 모드 ── */
            <>
              <div className="border-b flex flex-col shrink-0">
                <div className="flex items-center gap-2 px-3 h-14">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground -ml-1"
                    title="보기로 돌아가기"
                    aria-label="뒤로"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  {autoSavedAt && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      자동저장 {new Date(autoSavedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 shrink-0">
                    {draftsPopover}
                    <Button size="sm" variant="outline" onClick={handleSaveDraft} className="h-8 text-xs px-2.5">
                      임시저장
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={!dirty} className="h-8 text-xs px-2.5">
                      저장
                    </Button>
                  </div>
                </div>
                <div className="px-3 pb-3">
                  <Input
                    value={editTitle}
                    onChange={(e) => {
                      setEditTitle(e.target.value);
                      setDirty(true);
                    }}
                    className="w-full h-10 text-base font-semibold border-none bg-transparent focus-visible:ring-0 px-1 min-w-0 placeholder:text-muted-foreground/50 placeholder:font-normal"
                    placeholder="새 노트 제목..."
                  />
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <RichEditor
                  key={selectedItem.id}
                  content={selectedItem.content || ""}
                  onChange={(html) => {
                    setEditContent(html);
                    setDirty(true);
                  }}
                />
              </div>
            </>
          ) : (
            /* ── 읽기 모드 ── */
            <>
              <div className="flex items-center gap-2 border-b px-3 h-14 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemId(null);
                    setViewFolderId(null);
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground -ml-1"
                  title="지식창고 홈"
                  aria-label="홈으로"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="flex-1 truncate text-base font-semibold min-w-0">
                  {selectedItem.title || "(제목 없음)"}
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                  className="h-8 text-xs px-3 shrink-0"
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  편집
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {selectedItem.content ? (
                  <div
                    className="tiptap-editor"
                    dangerouslySetInnerHTML={{ __html: selectedItem.content }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    내용이 없습니다.
                    <button
                      type="button"
                      className="ml-1 text-primary underline"
                      onClick={() => setEditing(true)}
                    >
                      편집하기
                    </button>
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 border-t px-4 py-2 shrink-0">
                {/* 태그 */}
                {selectedItem.tags && selectedItem.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {selectedItem.tags.map((t) => (
                      <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {selectedItem.updated_at
                      ? `수정 ${new Date(selectedItem.updated_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                      : ""}
                  </span>
                  <span>
                    {selectedItem.created_at
                      ? `생성 ${new Date(selectedItem.created_at).toLocaleString("ko-KR", { month: "short", day: "numeric" })}`
                      : ""}
                  </span>
                </div>
              </div>
            </>
          )
        ) : viewFolderId ? (
          /* ── 폴더 노트 목록 ── */
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
              for (const id of ids) await deleteItem(id);
            }}
            onDeleteFolders={async (ids) => {
              for (const id of ids) { deleteFolder(id); }
              refetch();
            }}
            onRenameFolder={async (id, name) => { await updateFolder(id, { name }); }}
            onRenameItem={async (id, title) => { await updateItem(id, { title }); }}
            onMoveItems={async (ids, targetFolderId) => {
              for (const id of ids) await updateItem(id, { folder_id: targetFolderId });
            }}
          />
        ) : (
          /* ── 대시보드 홈 ── */
          <KnowledgeDashboard
            folders={folders}
            items={items}
            onSelectItem={(id) => setSelectedItemId(id)}
            onSelectFolder={(fid) => setViewFolderId(fid)}
            onSearch={(q) => setSearch(q)}
            searchQuery={search}
            searchResults={searchResults}
            onDeleteItems={async (ids) => {
              for (const id of ids) await deleteItem(id);
            }}
            onDeleteFolders={async (ids) => {
              for (const id of ids) { deleteFolder(id); }
              refetch();
            }}
            onRenameFolder={async (id, name) => { await updateFolder(id, { name }); }}
            onRenameItem={async (id, title) => { await updateItem(id, { title }); }}
            onReorderFolders={async (ids) => {
              for (let i = 0; i < ids.length; i++) {
                await updateFolder(ids[i], { sort_order: i });
              }
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
        onOpenChange={(o) => { if (!o) setPendingDraft(null); }}
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

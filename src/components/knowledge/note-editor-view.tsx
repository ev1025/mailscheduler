"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RichEditor from "@/components/knowledge/rich-editor";
import DraftsPopover from "@/components/knowledge/drafts-popover";
import type { KnowledgeItem } from "@/types";
import type { KnowledgeDraft } from "@/hooks/use-knowledge-drafts";

interface Props {
  item: KnowledgeItem;
  title: string;
  onTitleChange: (v: string) => void;
  onContentChange: (html: string) => void;
  onSave: () => void;
  onSaveDraft: () => void;
  onExit: () => void;
  dirty: boolean;
  autoSavedAt: string | null;
  drafts: KnowledgeDraft[];
  onLoadDraft: (d: KnowledgeDraft) => void;
  onDeleteDraft: (id: string) => void;
  draftsOpen: boolean;
  onDraftsOpenChange: (open: boolean) => void;
}

export default function NoteEditorView({
  item,
  title,
  onTitleChange,
  onContentChange,
  onSave,
  onSaveDraft,
  onExit,
  dirty,
  autoSavedAt,
  drafts,
  onLoadDraft,
  onDeleteDraft,
  draftsOpen,
  onDraftsOpenChange,
}: Props) {
  return (
    <>
      <div className="border-b flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-3 h-14">
          <button
            type="button"
            onClick={onExit}
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
            <DraftsPopover
              open={draftsOpen}
              onOpenChange={onDraftsOpenChange}
              drafts={drafts}
              onLoad={onLoadDraft}
              onDelete={onDeleteDraft}
            />
            <Button size="sm" variant="outline" onClick={onSaveDraft} className="h-8 text-xs px-2.5">
              임시저장
            </Button>
            <Button size="sm" onClick={onSave} disabled={!dirty} className="h-8 text-xs px-2.5">
              저장
            </Button>
          </div>
        </div>
        <div className="px-3 pb-3">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full h-10 text-base font-semibold border-none bg-transparent focus-visible:ring-0 px-1 min-w-0 placeholder:text-muted-foreground/50 placeholder:font-normal"
            placeholder="새 노트 제목..."
          />
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <RichEditor
          key={item.id}
          content={item.content || ""}
          onChange={onContentChange}
        />
      </div>
    </>
  );
}

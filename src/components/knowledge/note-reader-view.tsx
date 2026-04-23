"use client";

import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KnowledgeItem } from "@/types";

interface Props {
  item: KnowledgeItem;
  onEdit: () => void;
  onExit: () => void | Promise<void>;
}

export default function NoteReaderView({ item, onEdit, onExit }: Props) {
  return (
    <>
      <div className="flex items-center gap-2 border-b px-3 h-14 shrink-0">
        <button
          type="button"
          onClick={onExit}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground -ml-1"
          title="지식창고 홈"
          aria-label="홈으로"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="flex-1 truncate text-base font-semibold min-w-0">
          {item.title || "(제목 없음)"}
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="h-8 text-xs px-3 shrink-0"
        >
          <Pencil className="mr-1 h-3 w-3" />
          편집
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {item.content ? (
          <div
            className="tiptap-editor"
            dangerouslySetInnerHTML={{ __html: item.content }}
          />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">
            내용이 없습니다.
            <button
              type="button"
              className="ml-1 text-primary underline"
              onClick={onEdit}
            >
              편집하기
            </button>
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t px-4 py-2 shrink-0">
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {item.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {/* 수정·생성 정보 — 컨텐츠 폭만큼만 차지 (full-width 스트레치 금지). */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {item.updated_at && (
            <span>
              수정 {new Date(item.updated_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {item.created_at && (
            <span>
              생성 {new Date(item.created_at).toLocaleString("ko-KR", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

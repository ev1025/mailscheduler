"use client";

import { Pin, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Memo } from "@/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface MemoCardProps {
  memo: Memo;
  onEdit: (memo: Memo) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}

export default function MemoCard({
  memo,
  onEdit,
  onDelete,
  onTogglePin,
}: MemoCardProps) {
  return (
    <Card className="group relative">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {memo.pinned && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                고정
              </Badge>
            )}
            <CardTitle className="text-base truncate">{memo.title}</CardTitle>
          </div>
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onTogglePin(memo.id, memo.pinned)}
              title={memo.pinned ? "고정 해제" : "고정"}
            >
              <Pin
                className={`h-3.5 w-3.5 ${memo.pinned ? "fill-current" : ""}`}
              />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onEdit(memo)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(memo.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {memo.content && (
          <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
            {memo.content}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground/60">
          {format(new Date(memo.updated_at), "yyyy.MM.dd HH:mm", {
            locale: ko,
          })}
        </p>
      </CardContent>
    </Card>
  );
}

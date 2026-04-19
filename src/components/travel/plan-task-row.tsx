"use client";

import { MapPin, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TravelPlanTask } from "@/types";

// 일정 한 행 — 읽기 전용 콤팩트 뷰. 클릭 시 편집 시트가 열림.
// 1행 = 1일정. 드래그 핸들은 @dnd-kit 에서 dragHandle props 로 주입.

interface Props {
  task: TravelPlanTask;
  onClick: () => void;
  dragListeners?: React.HTMLAttributes<HTMLButtonElement>;
  dragAttributes?: React.HTMLAttributes<HTMLButtonElement>;
}

// HH:MM:SS → HH:MM
function formatTime(t: string | null): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export default function PlanTaskRow({ task, onClick, dragListeners, dragAttributes }: Props) {
  const time = formatTime(task.start_time);
  const tags = task.tag ? task.tag.split(",").map((s) => s.trim()).filter(Boolean) : [];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex items-start gap-2 rounded-md border bg-card px-2.5 py-2 hover:bg-accent/40 transition-colors cursor-pointer select-none"
    >
      {dragListeners !== undefined && (
        <button
          type="button"
          {...dragAttributes}
          {...dragListeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="드래그로 순서 변경"
          className="p-0.5 mt-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          {time && (
            <span className="text-xs font-semibold tabular-nums shrink-0">{time}</span>
          )}
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {task.place_name || "(장소 미입력)"}
          </span>
          {task.stay_minutes > 0 && (
            <span className="shrink-0 text-[10px] text-muted-foreground">{task.stay_minutes}분</span>
          )}
        </div>
        {(task.content || tags.length > 0 || task.place_address) && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="h-4 text-[10px] px-1.5 py-0">
                {t}
              </Badge>
            ))}
            {task.content && <span className="truncate">{task.content}</span>}
            {!task.content && task.place_address && (
              <span className="truncate">{task.place_address}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

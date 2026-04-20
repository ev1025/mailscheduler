"use client";

import { MapPin, GripVertical, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTravelCategories } from "@/hooks/use-travel-categories";
import type { TravelPlanTask } from "@/types";

// 일정 한 행 — 읽기 전용 콤팩트 뷰. 클릭 시 편집 시트가 열림.
// 1행 = 1일정. 드래그 핸들은 @dnd-kit 에서 dragHandle props 로 주입.

interface Props {
  task: TravelPlanTask;
  onClick: () => void;
  onDelete?: () => void;
  dragListeners?: React.HTMLAttributes<HTMLButtonElement>;
  dragAttributes?: React.HTMLAttributes<HTMLButtonElement>;
  expectedTime?: string | null;
}

// HH:MM:SS → HH:MM
function formatTime(t: string | null): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export default function PlanTaskRow({
  task,
  onClick,
  onDelete,
  dragListeners,
  dragAttributes,
  expectedTime,
}: Props) {
  const time = formatTime(task.start_time);
  // 사용자가 직접 입력한 시간과 계산된 예상 시간을 스타일 통일 (도착=다음 출발이므로 같은 형식)
  const displayTime = time || expectedTime || null;
  const { colors } = useTravelCategories();
  // tag 컬럼을 분류 단일값으로 사용. 콤마 포함 구버전 값은 첫 토큰만 취함.
  const category = task.tag ? task.tag.split(",")[0].trim() : "";
  const categoryColor = category ? colors[category] || "#6B7280" : null;

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
      className="group flex items-start gap-2 rounded-md border bg-card px-2.5 py-2 hover:bg-accent/40 transition-colors cursor-pointer select-none"
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
          {displayTime && (
            <span className="text-xs font-semibold tabular-nums shrink-0">{displayTime}</span>
          )}
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {task.place_name || "(장소 미입력)"}
          </span>
          {category && categoryColor && (
            <Badge
              className="shrink-0 text-[10px] px-1.5 py-0 h-4"
              style={{ backgroundColor: categoryColor + "20", color: categoryColor, borderColor: categoryColor + "40" }}
            >
              {category}
            </Badge>
          )}
          {task.stay_minutes > 0 && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              체류 {task.stay_minutes}분
            </span>
          )}
        </div>
        {(task.content || task.place_address) && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
            {task.content && <span className="truncate">{task.content}</span>}
            {!task.content && task.place_address && (
              <span className="truncate">{task.place_address}</span>
            )}
          </div>
        )}
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="일정 삭제"
          // 모바일에서는 항상 보임, 데스크톱(md+) 에서는 호버 시만
          className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity md:opacity-0 md:group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

"use client";

import { MapPin, GripVertical, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTravelCategories } from "@/hooks/use-travel-categories";
import { formatMinutes } from "@/lib/travel/providers";
import type { TravelPlanTask } from "@/types";

// 일정 한 행 — 2단 레이아웃.
// Row 1: [출발시간 ~ 도착시간]  📍 장소명
// Row 2: (체류시간)             🏞️ 분류 · 주소

interface Props {
  task: TravelPlanTask;
  onClick: () => void;
  onDelete?: () => void;
  dragListeners?: React.HTMLAttributes<HTMLButtonElement>;
  dragAttributes?: React.HTMLAttributes<HTMLButtonElement>;
  expectedTime?: string | null;
}

function formatTime(t: string | null): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function addMinutes(hhmm: string, addMin: number): string {
  const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
  const total = h * 60 + m + addMin;
  const w = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(w % 60).padStart(2, "0")}`;
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
  const arrivalTime = time || expectedTime || null;
  // 출발 시간 = 도착시간 + 체류시간
  const leaveTime =
    arrivalTime && task.stay_minutes > 0
      ? addMinutes(arrivalTime, task.stay_minutes)
      : null;

  const { colors } = useTravelCategories();
  // 신규 category 컬럼 우선. 없으면 구 tag 단일값으로 시도 (하위호환).
  const category =
    task.category ?? (task.tag ? task.tag.split(",")[0].trim() : "");
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
          className="p-0.5 mt-1 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="flex-1 min-w-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        {/* Row 1: 시간범위 | 장소 */}
        <div className="flex items-center justify-center gap-1 shrink-0 tabular-nums text-xs font-semibold min-w-[96px]">
          {arrivalTime ? (
            <>
              <span>{arrivalTime}</span>
              {leaveTime && (
                <>
                  <span className="text-muted-foreground font-normal">~</span>
                  <span>{leaveTime}</span>
                </>
              )}
            </>
          ) : (
            <span className="text-muted-foreground font-normal">--:--</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {task.place_name || "(장소 미입력)"}
          </span>
        </div>

        {/* Row 2: 체류시간(시간범위 ~ 아래 중앙 정렬) | 분류 · 주소 */}
        <div className="text-[10px] text-muted-foreground shrink-0 min-w-[96px] text-center">
          {task.stay_minutes > 0 ? `(${formatMinutes(task.stay_minutes)})` : ""}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground min-w-0">
          {category && categoryColor && (
            <Badge
              className="shrink-0 text-[10px] px-1.5 py-0 h-4"
              style={{
                backgroundColor: categoryColor + "20",
                color: categoryColor,
                borderColor: categoryColor + "40",
              }}
            >
              {category}
            </Badge>
          )}
          {task.content ? (
            <span className="truncate">{task.content}</span>
          ) : task.place_address ? (
            <span className="truncate">{task.place_address}</span>
          ) : null}
        </div>
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="일정 삭제"
          className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity md:opacity-0 md:group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

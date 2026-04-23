"use client";

import { useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMinutes } from "@/lib/travel/providers";
import { addMinutes, formatTime } from "@/lib/travel/time";
import { useTravelCategories } from "@/hooks/use-travel-categories";
import type { TravelPlanTask } from "@/types";

// 일정 한 행 — 3열 레이아웃으로 시간·장소 컬럼 분리.
// [드래그바] [시간 컬럼 고정폭] [장소·주소 flex] [hover 시 휴지통(md+)]
// Row 1:  [시간범위]   📍 장소명
// Row 2:  (체류시간)        주소/내용
// 삭제 UX: md 이상 데스크톱은 행 hover 시 우측 휴지통 표시, 모바일은 드래그바 탭 → Popover.

interface Props {
  task: TravelPlanTask;
  onClick: () => void;
  onDelete?: () => void;
  dragListeners?: React.HTMLAttributes<HTMLButtonElement>;
  dragAttributes?: React.HTMLAttributes<HTMLButtonElement>;
  expectedTime?: string | null;
}

export default function PlanTaskRow({
  task,
  onClick,
  onDelete,
  dragListeners,
  dragAttributes,
  expectedTime,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { colors: categoryColors } = useTravelCategories();
  const categoryColor = task.category ? categoryColors[task.category] : undefined;
  // expectedTime 은 체인 계산 결과 (중간 task) 또는 null (첫 task).
  // 체인 계산이 있으면 그걸 우선 — 잔류 start_time 이 있어도 무시해 교통수단
  // 변경 시 자동 반영. 첫 task 는 expectedTime=null 이라 stored start_time 사용.
  const time = formatTime(task.start_time);
  const arrivalTime = expectedTime || time || null;
  const leaveTime =
    arrivalTime && task.stay_minutes > 0
      ? addMinutes(arrivalTime, task.stay_minutes)
      : null;

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
      className="group flex items-stretch gap-0 rounded-md border bg-card hover:bg-accent/40 transition-colors cursor-pointer select-none"
    >
      {/* 드래그바 — 탭하면 Popover 메뉴 (삭제 등), 드래그하면 이동.
          1행·2행 사이(수직 중앙)에 위치시켜 카드 대칭감 확보. */}
      {dragListeners !== undefined && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center pl-0.5"
        >
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger
              {...dragAttributes}
              {...dragListeners}
              className="rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent cursor-grab active:cursor-grabbing touch-none"
              title="드래그로 이동 / 탭하면 메뉴"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent className="w-32 p-1" align="start" side="right">
              {onDelete && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* 본문 — 좌우 2개 컨테이너.
          [왼쪽: 시간·체류시간 세로] [오른쪽: 장소·주소 세로]
          왼쪽은 items-center 로 내부 모두 중앙정렬 → "~" 아래 "(체류시간)" 자동 정렬.
          왼쪽 컨테이너 고정 너비(5.5rem) 로 마커 x 위치 일정. */}
      <div className="flex-1 min-w-0 flex items-start gap-2 pl-0.5 pr-2 py-2">
        {/* 왼쪽: 시간 위, 체류시간 아래 */}
        <div className="shrink-0 flex flex-col items-center w-[5.5rem]">
          <div className="flex items-center gap-1 tabular-nums text-xs font-semibold">
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
              <span className="text-muted-foreground/60 font-normal">--:--</span>
            )}
          </div>
          {task.stay_minutes > 0 && (
            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
              ({formatMinutes(task.stay_minutes)})
            </div>
          )}
        </div>

        {/* 오른쪽: 장소 위, 주소 아래. 장소명 왼쪽엔 분류 텍스트(있을 때) */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {task.category && (
              <span
                className="text-[9px] shrink-0 px-1 py-0 rounded border leading-4"
                style={
                  categoryColor
                    ? {
                        backgroundColor: categoryColor + "20",
                        color: categoryColor,
                        borderColor: categoryColor + "40",
                      }
                    : undefined
                }
              >
                {task.category}
              </span>
            )}
            <span className="text-xs md:text-sm font-medium truncate">
              {task.place_name || "(장소 미입력)"}
            </span>
          </div>
          {(task.content || task.place_address) && (
            <div className="text-[10px] text-muted-foreground min-w-0 break-words line-clamp-2 leading-snug">
              {task.content || task.place_address}
            </div>
          )}
        </div>

        {/* 데스크톱 전용 hover 휴지통 — 모바일은 드래그바 Popover 로 대체.
            shrink-0 로 본문 내용 압박하지 않음. opacity-0 → group-hover:opacity-100. */}
        {onDelete && (
          <button
            type="button"
            aria-label="일정 삭제"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="hidden md:flex shrink-0 items-center justify-center h-7 w-7 rounded text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive hover:bg-destructive/10 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMinutes } from "@/lib/travel/providers";
import { addMinutes, formatTime } from "@/lib/travel/time";
import type { TravelPlanTask } from "@/types";

// 일정 한 행 — 3열 레이아웃으로 시간·장소 컬럼 분리.
// [드래그바] [시간 컬럼 고정폭] [장소·주소 flex]
// Row 1:  [시간범위]   📍 장소명
// Row 2:  (체류시간)        주소/내용
// 삭제는 휴지통 아이콘 대신 드래그바 탭 → Popover 메뉴로 제공.
// (여행 목록의 TravelRow 와 동일한 UX 패턴)

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
      className="group flex items-stretch gap-1 rounded-md border bg-card hover:bg-accent/40 transition-colors cursor-pointer select-none"
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

      {/* 본문 — 4열 grid: [arrival][sep][leave][flex]
          시간 행과 체류 행이 같은 grid 를 공유해서 col 너비 자동 일치 →
          "~" 와 "(체류시간)" 이 같은 col-2 안에서 justify-self-center 로 정렬됨.
          col 1·3 은 tabular-nums 로 arrival/leave 가 언제나 동일 폭 → 마커 x 고정.
          col 2 너비는 max(~, (체류시간)) 로 자동. */}
      <div className="flex-1 min-w-0 grid grid-cols-[auto_auto_auto_1fr] items-center gap-x-1 gap-y-0.5 px-2 py-2">
        {/* Row 1 — 시간 */}
        <span className="text-xs font-semibold tabular-nums">
          {arrivalTime ?? <span className="text-muted-foreground/60 font-normal">--:--</span>}
        </span>
        <span className="text-xs text-muted-foreground font-normal justify-self-center">
          {leaveTime ? "~" : ""}
        </span>
        <span className="text-xs font-semibold tabular-nums">
          {leaveTime ?? ""}
        </span>

        {/* Row 1 col 4 — 장소 (마커 + 이름) */}
        <span className="flex items-center gap-1.5 min-w-0 ml-2">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <path
              d="M12 22s7-7.5 7-13a7 7 0 10-14 0c0 5.5 7 13 7 13z"
              className="fill-red-500 stroke-red-600"
              strokeWidth={1.5}
            />
            <circle cx="12" cy="9" r="2.5" className="fill-white" />
          </svg>
          <span className="text-xs md:text-sm font-medium truncate">
            {task.place_name || "(장소 미입력)"}
          </span>
        </span>

        {/* Row 2 — 체류시간 (arrival/leave 폭은 invisible phantom 으로 유지) */}
        <span className="invisible text-xs font-semibold tabular-nums" aria-hidden="true">
          {arrivalTime || "--:--"}
        </span>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap justify-self-center">
          {task.stay_minutes > 0 ? `(${formatMinutes(task.stay_minutes)})` : ""}
        </span>
        <span className="invisible text-xs font-semibold tabular-nums" aria-hidden="true">
          {leaveTime || ""}
        </span>

        {/* Row 2 col 4 — 주소·내용 */}
        <span className="flex items-start gap-1.5 text-[10px] text-muted-foreground min-w-0 ml-2">
          {(task.content || task.place_address) && (
            <span className="flex-1 min-w-0 break-words line-clamp-2 leading-snug">
              {task.content || task.place_address}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

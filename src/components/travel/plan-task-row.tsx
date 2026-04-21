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
          여행목록의 TravelRow 와 동일 패턴. */}
      {dragListeners !== undefined && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-start pt-1.5 pl-0.5"
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

      {/* 본문 — grid 3 컬럼 (시간 고정 | 장소·주소 flex).
          grid-cols-[auto_1fr] 로 시간 열은 content-fit, 장소는 flex. */}
      {/* grid 의 시간 열을 고정 폭(5.5rem ≈ 88px) 으로 고정 — "22:38 ~ 22:53"
          max 길이에 딱 맞게 축소. gap-x-2 (8px ≈ 2칸) 로 마커 사이 거리 타이트하게. */}
      <div className="flex-1 min-w-0 grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-0.5 px-2 py-2">
        {/* 시간 열 — 고정 폭 안에서 좌측 정렬 */}
        <div className="flex items-center gap-1 tabular-nums text-xs font-semibold justify-start overflow-hidden">
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

        {/* 장소 열 */}
        <div className="flex items-center gap-1.5 min-w-0">
          {/* 빨간 물방울 + 안쪽 흰 구멍 마커 */}
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          >
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
        </div>

        {/* 체류시간 열 — 시간 컬럼 바로 아래. 시간 범위 중앙("~" 위치) 에 오도록 center. */}
        <div className="text-[10px] text-muted-foreground shrink-0 text-center self-start">
          {task.stay_minutes > 0 ? `(${formatMinutes(task.stay_minutes)})` : ""}
        </div>
        {/* 주소·내용 열 */}
        <div className="flex items-start gap-1.5 flex-wrap text-[10px] text-muted-foreground min-w-0">
          {(task.content || task.place_address) && (
            <span className="flex-1 min-w-0 break-words line-clamp-2 leading-snug">
              {task.content || task.place_address}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

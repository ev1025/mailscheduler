"use client";

import { GripVertical, Trash2 } from "lucide-react";
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
        {/* Row 1: 시간범위 | 장소 — 시간 col 은 content-fit (불필요한 좌측 여백 제거) */}
        <div className="flex items-center gap-1 shrink-0 tabular-nums text-xs font-semibold">
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
          {/* 빨간 마커 핀 — lucide MapPin 은 안쪽에 원형 구멍이 기본 포함.
              fill-current 과 stroke-current 양쪽 빨강 + className 으로 구멍이
              배경색(흰색) 유지되도록. (lucide 의 MapPin 은 두 path 로 구성: 외곽
              물방울 + 안쪽 원. 안쪽 원은 fill 적용 시 같이 채워져 안 보이니
              fill-red-500 이고 안쪽 원이 stroke-white 로 남도록 처리하기 위해
              별도 SVG 사용) */}
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

        {/* Row 2: 체류시간(시간범위 ~ 아래 중앙) | 주소·내용 */}
        <div className="text-[10px] text-muted-foreground shrink-0 text-center">
          {task.stay_minutes > 0 ? `(${formatMinutes(task.stay_minutes)})` : ""}
        </div>
        <div className="flex items-start gap-1.5 flex-wrap text-[10px] text-muted-foreground min-w-0">
          {(task.content || task.place_address) && (
            <span className="flex-1 min-w-0 break-words line-clamp-2 leading-snug">
              {task.content || task.place_address}
            </span>
          )}
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
          // 모바일: 아이콘 작게(h-3) + 우측 margin 축소(-mr-1) 로 끝에 바짝
          // 데스크탑: 평소대로 + hover 시만 노출
          className="shrink-0 p-1 -mr-1 md:p-1.5 md:mr-0 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity md:opacity-0 md:group-hover:opacity-100"
        >
          <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
        </button>
      )}
    </div>
  );
}

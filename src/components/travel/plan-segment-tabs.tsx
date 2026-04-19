"use client";

import type { TaskLeg } from "@/lib/travel/legs";

// 경로맵 상단 배타 세그먼트: [전체] | [일자별 ▼] | [경로별 ▼]
// segment 가 "all" 이면 day/leg 드롭다운은 비활성.

export type Segment =
  | { mode: "all" }
  | { mode: "day"; dayIndex: number }
  | { mode: "leg"; legIndex: number };

interface Props {
  segment: Segment;
  onChange: (s: Segment) => void;
  days: number[];        // 존재하는 day_index 목록
  legs: TaskLeg[];       // 좌표 있는 leg만 소비자 쪽에서 필터해서 전달
}

export default function PlanSegmentTabs({ segment, onChange, days, legs }: Props) {
  const activeMode = segment.mode;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="inline-flex rounded-md border bg-background overflow-hidden">
        <button
          type="button"
          onClick={() => onChange({ mode: "all" })}
          className={`px-3 h-8 text-xs transition-colors ${
            activeMode === "all" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
          }`}
        >
          전체
        </button>
        <button
          type="button"
          onClick={() => onChange({ mode: "day", dayIndex: days[0] ?? 0 })}
          disabled={days.length === 0}
          className={`px-3 h-8 text-xs border-l transition-colors disabled:opacity-40 ${
            activeMode === "day" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
          }`}
        >
          일자별
        </button>
        <button
          type="button"
          onClick={() => onChange({ mode: "leg", legIndex: 0 })}
          disabled={legs.length === 0}
          className={`px-3 h-8 text-xs border-l transition-colors disabled:opacity-40 ${
            activeMode === "leg" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
          }`}
        >
          경로별
        </button>
      </div>

      {activeMode === "day" && days.length > 0 && (
        <select
          value={segment.mode === "day" ? segment.dayIndex : 0}
          onChange={(e) => onChange({ mode: "day", dayIndex: parseInt(e.target.value) })}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          {days.map((d) => (
            <option key={d} value={d}>{d + 1}일차</option>
          ))}
        </select>
      )}

      {activeMode === "leg" && legs.length > 0 && (
        <select
          value={segment.mode === "leg" ? segment.legIndex : 0}
          onChange={(e) => onChange({ mode: "leg", legIndex: parseInt(e.target.value) })}
          className="h-8 rounded-md border bg-background px-2 text-xs max-w-[220px]"
        >
          {legs.map((l, i) => (
            <option key={`${l.fromTaskId}-${l.toTaskId}`} value={i}>
              {i + 1}. {l.fromTask.place_name} → {l.toTask.place_name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

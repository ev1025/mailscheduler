"use client";

import { ChevronRight } from "lucide-react";
import type { TransitSegment } from "@/lib/travel/providers";
import { busColor, subwayBadgeLabel, subwayLineColor } from "@/lib/travel/kr-transit-colors";

// 대중교통 구간 체인 표시 — 배지 먼저, 역 이름 뒤.
// 한 구간:  [호선배지] 출발역 → 도착역
// 환승:     [호선1] 출발역 → 도착역  ·  [호선2] 환승역 → 도착역
// 버스:     [버스번호] 출발정류장 → 도착정류장

function SubwayBadge({ name }: { name: string | null }) {
  const color = subwayLineColor(name);
  const label = subwayBadgeLabel(name);
  return (
    <span
      className="inline-flex items-center justify-center h-5 min-w-5 rounded-full px-1 text-[10px] font-bold text-white shrink-0"
      style={{ backgroundColor: color }}
      aria-label={name ?? "지하철 호선"}
    >
      {label}
    </span>
  );
}

function BusBadge({ name }: { name: string | null }) {
  const color = busColor(name);
  return (
    <span
      className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-bold text-white shrink-0"
      style={{ backgroundColor: color }}
      aria-label={name ? `${name}번 버스` : "버스"}
    >
      {name ?? "버스"}
    </span>
  );
}

function SegmentBadge({ segment }: { segment: TransitSegment }) {
  if (segment.kind === "bus") return <BusBadge name={segment.name} />;
  return <SubwayBadge name={segment.name} />;
}

export default function TransitSegmentChain({
  segments,
}: {
  segments: TransitSegment[] | undefined;
}) {
  if (!segments || segments.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      {segments.map((s, i) => (
        <div key={i} className="flex items-center gap-1 min-w-0">
          {/* 배지 먼저 */}
          <SegmentBadge segment={s} />
          {/* 출발역 → 도착역 (이름만) */}
          {s.fromStop && (
            <span className="text-[11px] text-foreground truncate max-w-[6rem]">
              {s.fromStop}
            </span>
          )}
          {s.toStop && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <span className="text-[11px] text-foreground truncate max-w-[6rem]">
                {s.toStop}
              </span>
            </>
          )}
          {/* 환승 구분자 — segment 사이 · */}
          {i < segments.length - 1 && (
            <span className="text-muted-foreground/50 mx-1">·</span>
          )}
        </div>
      ))}
    </div>
  );
}

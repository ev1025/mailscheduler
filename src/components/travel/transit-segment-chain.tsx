"use client";

import { ArrowDown } from "lucide-react";
import type { TransitSegment } from "@/lib/travel/providers";
import {
  busColor,
  cleanStopName,
  subwayBadgeLabel,
  subwayLineColor,
} from "@/lib/travel/kr-transit-colors";

// 대중교통 구간 체인 — 각 segment 를 세로 블록으로 표시.
// 한 segment 블록:
//   [배지] 출발역
//         ↓ (작은 화살표)
//         도착역
// 환승 구간은 다음 블록이 이어짐.
// 역명은 cleanStopName 으로 Google 이 붙이는 "." 랜드마크·호선 prefix 제거해 정리.

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

interface Props {
  segments: TransitSegment[] | undefined;
  filterKinds?: "bus" | "rail";
}

export default function TransitSegmentChain({ segments, filterKinds }: Props) {
  if (!segments || segments.length === 0) return null;

  const filtered =
    filterKinds === "bus"
      ? segments.filter((s) => s.kind === "bus")
      : filterKinds === "rail"
        ? segments.filter((s) => s.kind === "subway" || s.kind === "train" || s.kind === "tram")
        : segments;

  if (filtered.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {filtered.map((s, i) => {
        const from = cleanStopName(s.fromStop);
        const to = cleanStopName(s.toStop);
        return (
          <div key={i} className="flex items-start gap-2 text-[11px] leading-tight">
            <SegmentBadge segment={s} />
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              {from && <span className="text-foreground break-keep">{from}</span>}
              {to && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <ArrowDown className="h-2.5 w-2.5 shrink-0" />
                  <span className="text-foreground break-keep">{to}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { ArrowRight } from "lucide-react";
import type { TransitSegment } from "@/lib/travel/providers";
import {
  busColor,
  cleanStopName,
  subwayBadgeLabel,
  subwayLineColor,
} from "@/lib/travel/kr-transit-colors";

// 대중교통 구간 체인 — 각 segment 한 줄: [배지] 출발역 → 도착역
// 환승이면 줄이 이어짐. 역명은 cleanStopName 으로 "." 랜드마크·호선 prefix 제거.
// 너비가 좁으면 역명이 wrap 될 수 있으나 화살표와 순서 관계는 가로(→) 로 유지.

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
    <div className="flex flex-col gap-1 w-full">
      {filtered.map((s, i) => {
        const from = cleanStopName(s.fromStop);
        const to = cleanStopName(s.toStop);
        // 지하철·기차·트램은 도착역에도 호선 배지 반복 (같은 호선 이어감을 시각적으로 강조).
        // 버스는 번호 배지 1개로 충분.
        const repeatBadge = s.kind === "subway" || s.kind === "train" || s.kind === "tram";
        return (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[11px] leading-tight text-foreground flex-wrap"
          >
            <SegmentBadge segment={s} />
            {from && <span className="break-keep">{from}</span>}
            {to && (
              <>
                <ArrowRight className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                {repeatBadge && <SegmentBadge segment={s} />}
                <span className="break-keep">{to}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

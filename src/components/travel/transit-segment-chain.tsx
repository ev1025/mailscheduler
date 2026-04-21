"use client";

import { ChevronRight } from "lucide-react";
import type { TransitSegment } from "@/lib/travel/providers";
import { busColor, subwayBadgeLabel, subwayLineColor } from "@/lib/travel/kr-transit-colors";

// 대중교통 구간 체인 표시 — 각 segment 는 세로로 한 줄 차지.
// 한 줄 구성: [호선/버스번호 배지]  출발역  →  도착역
// 환승이면 줄이 n 개 이어짐. 역명은 잘리지 않고 전체 표시 (wrap 가능).
//
// filterKinds 로 지하철 모드에선 버스 segment 만 들어와도 걸러낼 수 있음.
// Google transit_mode=subway|train|rail 가 hard filter 가 아니라 선호만이라
// 프런트에서 보조 필터 필요.

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
  /**
   * 표시할 segment 종류 제한.
   *  - "bus": 버스 구간만 (버스 모드)
   *  - "rail": 지하철·기차·트램 (지하철 모드)
   *  - undefined: 제한 없음
   */
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
    // 각 segment 한 줄. 줄 사이 간격 넉넉하게.
    <div className="flex flex-col gap-1 w-full">
      {filtered.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[11px] text-foreground">
          <SegmentBadge segment={s} />
          {s.fromStop && (
            <span className="break-all">{s.fromStop}</span>
          )}
          {s.toStop && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <span className="break-all">{s.toStop}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

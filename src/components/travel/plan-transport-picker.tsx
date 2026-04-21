"use client";

import { useMemo } from "react";
import { Check, Zap, Edit3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DeviceDialog from "@/components/ui/device-dialog";
import { formatDuration } from "@/lib/travel/providers";
import { useRouteDurations } from "@/hooks/use-route-data";
import TransitSegmentChain from "@/components/travel/transit-segment-chain";
import type { TransportMode } from "@/types";
import { useEffect, useState } from "react";

// 이동수단 선택 모달 — 모바일 바텀시트 / 데스크탑 Dialog (DeviceDialog 자동 전환).
// useRouteDurations 훅으로 4수단 동시 fetch + 모듈 레벨 캐시.
// 기차는 실사용상 지하철/기차 통합이므로 라벨 "지하철" 로 통일.

const MODES: { value: TransportMode; label: string; emoji: string }[] = [
  { value: "walk", label: "도보", emoji: "🚶" },
  { value: "car", label: "승용차", emoji: "🚗" },
  { value: "bus", label: "버스", emoji: "🚌" },
  { value: "train", label: "지하철", emoji: "🚇" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  legDeparture: string | null;
  selectedMode: TransportMode | null;
  onSelect: (mode: TransportMode, durationSec: number | null) => void;
  onSelectManual: () => void;
}

function addMinutes(hhmm: string, addMin: number): string {
  const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
  const total = h * 60 + m + addMin;
  const w = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(w % 60).padStart(2, "0")}`;
}

export default function PlanTransportPicker({
  open,
  onOpenChange,
  from,
  to,
  legDeparture,
  selectedMode,
  onSelect,
  onSelectManual,
}: Props) {
  const { durations, results, errors } = useRouteDurations(from, to, open);

  const fastestMode = useMemo(() => {
    let best: TransportMode | null = null;
    let min = Infinity;
    for (const m of MODES) {
      const d = durations[m.value];
      if (typeof d === "number" && d > 0 && d < min) {
        min = d;
        best = m.value;
      }
    }
    return best;
  }, [durations]);

  return (
    <DeviceDialog
      open={open}
      onOpenChange={onOpenChange}
      title="이동수단 선택"
      desktopMaxWidth="max-w-sm"
      snapPoints={[0.5, 0.9]}
      defaultSnapIndex={0}
    >
      <div className="flex flex-col gap-1 px-1 py-2">
        {legDeparture && (
          <p className="text-xs text-muted-foreground px-3 pb-2">
            출발 <span className="font-semibold text-foreground tabular-nums">{legDeparture}</span> 기준
          </p>
        )}
        {MODES.map((m) => {
          const d = durations[m.value];
          const selected = selectedMode === m.value;
          const isFastest = fastestMode === m.value;
          const arrival =
            legDeparture && typeof d === "number"
              ? addMinutes(legDeparture, Math.max(1, Math.round(d / 60)))
              : null;
          const err = errors[m.value];
          // 지하철 모드에선 버스 segment 만 나오는 결과를 "지하철 경로 없음" 처리.
          // Google transit_mode 가 강제 필터가 아니라 선호만이라 버스 경로가 반환될 수 있음.
          const rawSegments = results[m.value]?.segments ?? [];
          const railSegments = rawSegments.filter(
            (s) => s.kind === "subway" || s.kind === "train" || s.kind === "tram"
          );
          const trainHasOnlyBus =
            m.value === "train" && rawSegments.length > 0 && railSegments.length === 0;

          const label =
            d === "loading" ? "계산 중…" :
            trainHasOnlyBus ? "지하철 경로 없음" :
            d === null ? (err?.message ?? "계산 실패") :
            formatDuration(d);

          // 버스·지하철 세그먼트 체인 표시 (호선 배지 + 역 이름).
          // 지하철 모드: rail 만. 버스 모드: bus 만.
          const showSegments =
            (m.value === "bus" || m.value === "train") && !trainHasOnlyBus && rawSegments.length > 0;
          const filterKinds: "bus" | "rail" | undefined =
            m.value === "bus" ? "bus" : m.value === "train" ? "rail" : undefined;

          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onSelect(m.value, typeof d === "number" ? d : null)}
              disabled={d === "loading"}
              className={`flex items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
                selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-accent"
              }`}
            >
              <span className="text-2xl shrink-0">{m.emoji}</span>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-sm">{m.label}</span>
                  {isFastest && (
                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                      <Zap className="h-2.5 w-2.5 fill-amber-500 stroke-amber-600" />
                      최속
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  <span className={d === null ? "" : "font-medium text-foreground"}>{label}</span>
                  {arrival && (
                    <>
                      <span>·</span>
                      <span>도착 {arrival}</span>
                    </>
                  )}
                </div>
                {showSegments && (
                  <div className="mt-1.5">
                    <TransitSegmentChain
                      segments={results[m.value]!.segments}
                      filterKinds={filterKinds}
                    />
                  </div>
                )}
              </div>
              {selected && <Check className="h-4 w-4 shrink-0 text-primary mt-1" />}
            </button>
          );
        })}

        <div className="border-t mt-1 pt-1">
          <button
            type="button"
            onClick={onSelectManual}
            className="flex items-center gap-3 rounded-md px-3 py-2 w-full text-left text-xs text-muted-foreground hover:bg-accent"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>수동으로 소요시간 직접 입력</span>
          </button>
        </div>
      </div>
    </DeviceDialog>
  );
}

// 수동 입력 전용 소형 Dialog — 데스크탑에도 동일하게 표시 (작은 모달)
export function ManualDurationDialog({
  open,
  onOpenChange,
  initialMinutes,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMinutes: number;
  onSave: (minutes: number) => void;
}) {
  const [value, setValue] = useState(String(initialMinutes || ""));
  useEffect(() => {
    if (open) setValue(String(initialMinutes || ""));
  }, [open, initialMinutes]);

  const commit = () => {
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && n >= 0) {
      onSave(n);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm">소요시간 직접 입력</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 px-4 pb-2">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
            placeholder="분"
            autoFocus
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground">분</span>
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>취소</Button>
          <Button type="button" className="flex-1" onClick={commit}>저장</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DeviceDialog from "@/components/ui/device-dialog";
import { formatDuration } from "@/lib/travel/providers";
import { useRouteDurations } from "@/hooks/use-route-data";
import TransitSegmentChain from "@/components/travel/transit-segment-chain";
import type { TransportMode } from "@/types";

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
  /** 수동 입력 저장 — 분 단위 */
  onManualSave: (minutes: number) => void;
  /** 수동 입력 초기값 (기존 수동값이 있으면) */
  initialManualMinutes?: number;
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
  onManualSave,
  initialManualMinutes,
}: Props) {
  const { durations, results, errors } = useRouteDurations(from, to, open);
  const [manualMinutes, setManualMinutes] = useState(
    initialManualMinutes ? String(initialManualMinutes) : ""
  );

  // open 될 때마다 초기값 리셋
  useEffect(() => {
    if (open) setManualMinutes(initialManualMinutes ? String(initialManualMinutes) : "");
  }, [open, initialManualMinutes]);

  const commitManual = () => {
    const n = parseInt(manualMinutes, 10);
    if (Number.isFinite(n) && n > 0) {
      onManualSave(n);
      onOpenChange(false);
    }
  };

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
      defaultSnapIndex={1}
    >
      <div className="flex flex-col gap-1 px-1 py-2">
        {legDeparture && (
          // 서브헤더 — 타이틀("이동수단 선택", text-base · medium) 과 구분되도록
          // text-[11px] · muted-foreground + 시간은 tabular-nums 강조
          <p className="px-3 pb-2 -mt-1 text-[11px] text-muted-foreground">
            출발{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {legDeparture}
            </span>{" "}
            기준
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

        {/* 수동 입력 — 같은 카드에서 바로 입력·저장. 팝업 없음. */}
        <div className="mt-2 pt-2 border-t border-dashed">
          <div className="flex items-start gap-3 rounded-md px-3 py-2.5">
            <span className="text-2xl shrink-0" aria-hidden="true">✏️</span>
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <span className="font-medium text-sm">수동 입력</span>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitManual();
                    }
                  }}
                  placeholder="분"
                  className="h-8 w-20 text-xs tabular-nums"
                />
                <span className="text-xs text-muted-foreground">분</span>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={!manualMinutes || parseInt(manualMinutes, 10) <= 0}
                  onClick={commitManual}
                >
                  저장
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DeviceDialog>
  );
}


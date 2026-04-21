"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DeviceDialog from "@/components/ui/device-dialog";
import { formatDuration } from "@/lib/travel/providers";
import { useRouteDurations } from "@/hooks/use-route-data";
import TransitSegmentChain from "@/components/travel/transit-segment-chain";
import { addMinutes } from "@/lib/travel/time";
import type { TransportMode } from "@/types";

// 이동수단 선택 모달 — 모바일 바텀시트 / 데스크탑 Dialog (DeviceDialog 자동 전환).
// useRouteDurations 훅으로 4수단 동시 fetch + 모듈 레벨 캐시.
// 기차는 실사용상 지하철/기차 통합이므로 라벨 "지하철" 로 통일.

// 표시 순서 — 사용 빈도 기준: 버스·지하철 먼저, 도보·승용차는 아래.
// 수동 입력은 별도로 맨 위에 배치 (picker 내부 렌더에서 처리).
const MODES: { value: TransportMode; label: string; emoji: string }[] = [
  { value: "bus", label: "버스", emoji: "🚌" },
  { value: "train", label: "지하철", emoji: "🚈" },
  { value: "walk", label: "도보", emoji: "🚶" },
  { value: "car", label: "승용차", emoji: "🚗" },
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
  // 수동 입력 — 분/시간 토글. plan-task-sheet 의 체류시간 입력과 동일 패턴.
  const [manualValue, setManualValue] = useState(
    initialManualMinutes ? String(initialManualMinutes) : ""
  );
  const [manualUnit, setManualUnit] = useState<"min" | "hour">("min");

  // open 될 때마다 초기값 리셋
  useEffect(() => {
    if (open) {
      setManualValue(initialManualMinutes ? String(initialManualMinutes) : "");
      setManualUnit("min");
    }
  }, [open, initialManualMinutes]);

  const handleManualChange = (v: string) => {
    if (manualUnit === "hour") {
      setManualValue(v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"));
    } else {
      setManualValue(v.replace(/[^0-9]/g, ""));
    }
  };

  const toggleManualUnit = () => {
    const n = parseFloat(manualValue);
    if (manualUnit === "min") {
      setManualUnit("hour");
      if (Number.isFinite(n) && n > 0) {
        const hours = n / 60;
        setManualValue(hours % 1 === 0 ? String(hours) : hours.toFixed(1));
      }
    } else {
      setManualUnit("min");
      if (Number.isFinite(n) && n > 0) {
        setManualValue(String(Math.round(n * 60)));
      }
    }
  };

  const commitManual = () => {
    const n = parseFloat(manualValue);
    if (!Number.isFinite(n) || n <= 0) return;
    const mins = manualUnit === "hour" ? Math.round(n * 60) : Math.floor(n);
    onManualSave(mins);
    onOpenChange(false);
  };

  const manualValid = (() => {
    const n = parseFloat(manualValue);
    return Number.isFinite(n) && n > 0;
  })();

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
      snapPoints={[0.6]}
      defaultSnapIndex={0}
    >
      <div className="flex flex-col gap-1 px-1 py-2">
        {legDeparture && (
          <p className="px-3 pb-2 -mt-1 text-[11px] text-muted-foreground">
            출발{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {legDeparture}
            </span>{" "}
            기준
          </p>
        )}

        {/* 수동 입력 — 최상단 · 1행. 일정수정의 체류시간 분/시간 토글 동일 패턴. */}
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="text-xl shrink-0" aria-hidden="true">✏️</span>
          <span className="font-medium text-sm shrink-0">수동 입력</span>
          <div className="flex items-center h-8 rounded-md border bg-transparent overflow-hidden">
            <Input
              type="text"
              inputMode={manualUnit === "hour" ? "decimal" : "numeric"}
              value={manualValue}
              onChange={(e) => handleManualChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitManual();
                }
              }}
              placeholder={manualUnit === "hour" ? "시간" : "분"}
              className="h-full text-xs w-14 border-0 rounded-none focus-visible:ring-0 px-2 tabular-nums"
            />
            <button
              type="button"
              onClick={toggleManualUnit}
              className="h-full px-2 text-xs font-medium border-l bg-muted/50 hover:bg-muted text-muted-foreground"
              title="분/시간 단위 전환"
            >
              {manualUnit === "hour" ? "시간" : "분"}
            </button>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 px-3 text-xs ml-auto"
            disabled={!manualValid}
            onClick={commitManual}
          >
            저장
          </Button>
        </div>

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
              className={`grid grid-cols-[2.25rem_1fr_auto] gap-x-2 gap-y-0.5 items-center rounded-md px-3 py-2 text-left transition-colors disabled:opacity-60 ${
                selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-accent"
              }`}
            >
              {/* Row 1: 이모지 | 소요시간 | check */}
              <span className="text-xl text-center row-start-1 col-start-1" aria-hidden="true">
                {m.emoji}
              </span>
              <div className="row-start-1 col-start-2 flex items-center gap-2 text-xs text-muted-foreground tabular-nums min-w-0">
                <span className={d === null ? "" : "font-medium text-foreground text-sm"}>{label}</span>
                {arrival && (
                  <>
                    <span>·</span>
                    <span>도착 {arrival}</span>
                  </>
                )}
                {isFastest && (
                  <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                    <Zap className="h-2.5 w-2.5 fill-amber-500 stroke-amber-600" />
                    최속
                  </span>
                )}
              </div>
              <span className="row-start-1 col-start-3 row-span-2 flex items-center justify-center w-4">
                {selected && <Check className="h-4 w-4 text-primary" />}
              </span>

              {/* Row 2: 수단 | 경로 */}
              <span className="row-start-2 col-start-1 text-[11px] text-muted-foreground text-center">
                {m.label}
              </span>
              <div className="row-start-2 col-start-2 min-w-0">
                {showSegments ? (
                  <TransitSegmentChain
                    segments={results[m.value]!.segments}
                    filterKinds={filterKinds}
                  />
                ) : null}
              </div>
            </button>
          );
        })}

      </div>
    </DeviceDialog>
  );
}


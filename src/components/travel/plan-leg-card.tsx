"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TaskLeg } from "@/lib/travel/legs";
import type { TransportMode, TransportRouteStep } from "@/types";
import {
  busColor,
  cleanStopName,
  subwayLineColor,
} from "@/lib/travel/kr-transit-colors";
import { formatDuration, type TransitSegment } from "@/lib/travel/providers";
import { getRouteData } from "@/hooks/use-route-data";
import PlanTransportPicker from "@/components/travel/plan-transport-picker";
import TransitSegmentChain from "@/components/travel/transit-segment-chain";

// Leg 카드 (2-line compact).
// Unselected:   [ 이동수단 선택 ▾ ]
// Selected:     🚶 도보 16분  (탭하면 picker 재오픈)
//
// picker 안에 수동 입력까지 포함되어 더 이상 별도 팝업 없음.

const MODE_ICON: Record<TransportMode, { emoji: string; label: string }> = {
  car: { emoji: "🚗", label: "승용차" },
  walk: { emoji: "🚶", label: "도보" },
  bus: { emoji: "🚌", label: "버스" },
  train: { emoji: "🚈", label: "지하철" },
  taxi: { emoji: "🚗", label: "승용차" }, // 하위호환
  transit: { emoji: "🚆", label: "대중교통" }, // 조합 경로 (도보+버스+지하철)
};

interface Props {
  leg: TaskLeg;
  legDeparture: string | null;
  onUpdateTask: (taskId: string, updates: Partial<{
    transport_mode: TransportMode | null;
    transport_duration_sec: number | null;
    transport_manual: boolean;
    transport_durations: Partial<Record<TransportMode, number | null>> | null;
    transport_route: TransportRouteStep[] | null;
  }>) => void;
}

export default function PlanLegCard({ leg, legDeparture, onUpdateTask }: Props) {
  const { fromTask, toTask } = leg;
  const hasCoords =
    fromTask.place_lat != null &&
    fromTask.place_lng != null &&
    toTask.place_lat != null &&
    toTask.place_lng != null;

  const [pickerOpen, setPickerOpen] = useState(false);

  const mode = toTask.transport_mode;
  const durationSec = toTask.transport_duration_sec;
  const isManual = toTask.transport_manual;
  const icon = mode ? MODE_ICON[mode] : null;
  const initialManualMinutes =
    isManual && durationSec ? Math.round(durationSec / 60) : undefined;

  // 버스·지하철 선택됐으면 segments 상세도 목록에 표시 — 캐시에서 가져옴
  const [segments, setSegments] = useState<TransitSegment[] | undefined>(undefined);
  useEffect(() => {
    if (!hasCoords || !mode || (mode !== "bus" && mode !== "train")) {
      setSegments(undefined);
      return;
    }
    let cancelled = false;
    getRouteData(
      { lat: fromTask.place_lat!, lng: fromTask.place_lng! },
      { lat: toTask.place_lat!, lng: toTask.place_lng! },
      mode
    ).then((r) => {
      if (!cancelled) setSegments(r?.segments);
    });
    return () => { cancelled = true; };
  }, [
    hasCoords,
    mode,
    fromTask.place_lat,
    fromTask.place_lng,
    toTask.place_lat,
    toTask.place_lng,
  ]);

  const filterKinds: "bus" | "rail" | undefined =
    mode === "bus" ? "bus" : mode === "train" ? "rail" : undefined;

  const handleSelect = (
    selectedMode: TransportMode,
    selectedDurationSec: number | null,
    route?: TransportRouteStep[]
  ) => {
    onUpdateTask(toTask.id, {
      transport_mode: selectedMode,
      transport_duration_sec: selectedDurationSec,
      transport_manual: false,
      // transit 이면 route step 저장, 아니면 null 로 덮어써서 이전 잔해 제거
      transport_route: selectedMode === "transit" ? (route ?? null) : null,
    });
    setPickerOpen(false);
  };

  const handleManual = (minutes: number) => {
    onUpdateTask(toTask.id, {
      transport_duration_sec: minutes * 60,
      transport_manual: true,
      // mode 는 직전 것 유지 (없으면 "car" 기본)
      transport_mode: toTask.transport_mode ?? "car",
      transport_route: null,
    });
  };

  if (!mode || durationSec == null) {
    return (
      <>
        <div className="flex items-center ml-6 pl-2 border-l-2 border-dashed border-muted-foreground/30 py-1">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={!hasCoords}
            className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <span>이동수단 선택</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {!hasCoords && (
            <span className="text-[10px] text-muted-foreground ml-2">좌표 없음</span>
          )}
        </div>
        {hasCoords && (
          <PlanTransportPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            from={{ lat: fromTask.place_lat!, lng: fromTask.place_lng! }}
            to={{ lat: toTask.place_lat!, lng: toTask.place_lng! }}
            legDeparture={legDeparture}
            selectedMode={null}
            onSelect={handleSelect}
            onManualSave={handleManual}
            initialManualMinutes={initialManualMinutes}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* 전체 블록 클릭 시 picker 재오픈 — 별도 "변경" 버튼 없음 */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex flex-col ml-6 pl-2 border-l-2 border-primary/30 py-1.5 gap-1.5 text-left hover:bg-accent/40 rounded-r-md transition-colors"
        title="이동수단 변경"
      >
        <div className="flex items-center gap-1 text-xs min-w-0">
          <span>{icon?.emoji}</span>
          <span className="text-primary font-medium">{icon?.label}</span>
          <span className="text-foreground">{formatDuration(durationSec)}</span>
          {isManual && <span className="text-[10px] text-muted-foreground">(수동)</span>}
        </div>
        {/* 대중교통 조합(transit) — 각 step:
            [출발역 ➔ 도착역]  (bold, 큰 폰트)
            [🚌|🚇 풀네임 배지들]
            도보 step 은 생략. */}
        {mode === "transit" && toTask.transport_route && toTask.transport_route.length > 0 && (
          <div className="flex flex-col gap-2 pl-1 pointer-events-none">
            {toTask.transport_route
              .filter((s) => s.kind !== "walk")
              .map((s, i) => {
                const names =
                  s.alternateNames && s.alternateNames.length > 0
                    ? s.alternateNames
                    : s.name
                      ? [s.name]
                      : [];
                const from = cleanStopName(s.fromStop);
                const to = cleanStopName(s.toStop);
                return (
                  <div key={i} className="flex flex-col gap-0.5 min-w-0">
                    {/* 타이틀: 출발역 ➔ 도착역 */}
                    <div className="text-sm font-bold break-keep">
                      {from}
                      {to && <span className="mx-1">➔</span>}
                      {to}
                    </div>
                    {/* 서브: 이모지 + 풀네임 배지 */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span aria-hidden="true" className="text-sm">
                        {s.kind === "bus" ? "🚌" : "🚇"}
                      </span>
                      {names.map((name, j) =>
                        s.kind === "bus" ? (
                          <BusBadgeFull key={j} name={name} />
                        ) : (
                          <SubwayBadgeFull key={j} name={name} />
                        )
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
        {/* 단일 버스·지하철 selected 상태에서 세그먼트 상세(배지+역명) 표시 */}
        {!isManual && mode !== "transit" && segments && segments.length > 0 && (
          <div className="pl-1 pointer-events-none">
            <TransitSegmentChain segments={segments} filterKinds={filterKinds} />
          </div>
        )}
      </button>
      {hasCoords && (
        <PlanTransportPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          from={{ lat: fromTask.place_lat!, lng: fromTask.place_lng! }}
          to={{ lat: toTask.place_lat!, lng: toTask.place_lng! }}
          legDeparture={legDeparture}
          selectedMode={mode === "taxi" ? "car" : mode}
          onSelect={handleSelect}
          onManualSave={handleManual}
          initialManualMinutes={initialManualMinutes}
        />
      )}
    </>
  );
}

// transit 구간 배지 (풀 라벨) — "3호선" "KTX" "704" 등 이름 그대로 표시.
function SubwayBadgeFull({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: subwayLineColor(name) }}
    >
      {name}
    </span>
  );
}

function BusBadgeFull({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center h-5 px-2 rounded text-[11px] font-semibold text-white"
      style={{ backgroundColor: busColor(name) }}
    >
      {name}
    </span>
  );
}

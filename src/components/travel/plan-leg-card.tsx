"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TaskLeg } from "@/lib/travel/legs";
import type { TransportMode } from "@/types";
import { formatDuration } from "@/lib/travel/providers";
import PlanTransportPicker, { ManualDurationDialog } from "@/components/travel/plan-transport-picker";

// Leg 카드 (2-line compact).
// Unselected:
//   : ---   [ 이동수단 선택 ▾ ]
// Selected:
//   22:38  →  🚶 도보 16분  →  22:53    [변경]
//
// 클릭 시 PlanTransportPicker (바텀시트/Dialog) 열려 4개 수단 비교·선택.
// 선택된 수단·duration 은 DB 의 transport_mode · transport_duration_sec 에 저장.
// 이번 picker 에서 새로 얻은 모든 수단 duration 도 transport_durations JSONB 에
// 캐시 → 다음에 picker 열면 즉시 표시.

const MODE_ICON: Record<TransportMode, { emoji: string; label: string }> = {
  car: { emoji: "🚗", label: "승용차" },
  walk: { emoji: "🚶", label: "도보" },
  bus: { emoji: "🚌", label: "버스" },
  train: { emoji: "🚇", label: "지하철" },
  taxi: { emoji: "🚗", label: "승용차" }, // 하위호환
};

interface Props {
  leg: TaskLeg;
  legDeparture: string | null;
  onUpdateTask: (taskId: string, updates: Partial<{
    transport_mode: TransportMode | null;
    transport_duration_sec: number | null;
    transport_manual: boolean;
    transport_durations: Partial<Record<TransportMode, number | null>> | null;
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
  const [manualOpen, setManualOpen] = useState(false);

  const mode = toTask.transport_mode;
  const durationSec = toTask.transport_duration_sec;
  const isManual = toTask.transport_manual;
  const icon = mode ? MODE_ICON[mode] : null;

  const handleSelect = (
    selectedMode: TransportMode,
    selectedDurationSec: number | null
  ) => {
    onUpdateTask(toTask.id, {
      transport_mode: selectedMode,
      transport_duration_sec: selectedDurationSec,
      transport_manual: false,
    });
    setPickerOpen(false);
  };

  const handleManual = (minutes: number) => {
    onUpdateTask(toTask.id, {
      transport_duration_sec: minutes * 60,
      transport_manual: true,
      // mode 는 직전 것 유지 (없으면 "car" 기본)
      transport_mode: toTask.transport_mode ?? "car",
    });
  };

  // Unselected 상태: 선택 버튼만 (시간은 task row 에서 표시하므로 생략)
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
            onSelectManual={() => {
              setPickerOpen(false);
              setManualOpen(true);
            }}
          />
        )}
        <ManualDurationDialog
          open={manualOpen}
          onOpenChange={setManualOpen}
          initialMinutes={0}
          onSave={handleManual}
        />
      </>
    );
  }

  // Selected 상태: 수단 · 소요시간만 (시간은 task row 에서 표시)
  return (
    <>
      <div className="flex items-center ml-6 pl-2 border-l-2 border-primary/30 py-1">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs hover:bg-primary/20 transition-colors"
          title="수단 변경"
        >
          <span>{icon?.emoji}</span>
          <span className="text-primary font-medium">{icon?.label}</span>
          <span className="text-foreground">{formatDuration(durationSec)}</span>
          {isManual && <span className="text-[10px] text-muted-foreground">(수동)</span>}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
      {hasCoords && (
        <PlanTransportPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          from={{ lat: fromTask.place_lat!, lng: fromTask.place_lng! }}
          to={{ lat: toTask.place_lat!, lng: toTask.place_lng! }}
          legDeparture={legDeparture}
          selectedMode={mode === "taxi" ? "car" : mode}
          onSelect={handleSelect}
          onSelectManual={() => {
            setPickerOpen(false);
            setManualOpen(true);
          }}
        />
      )}
      <ManualDurationDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        initialMinutes={isManual && durationSec ? Math.round(durationSec / 60) : 0}
        onSave={handleManual}
      />
    </>
  );
}

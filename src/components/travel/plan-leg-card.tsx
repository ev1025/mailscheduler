"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { TaskLeg } from "@/lib/travel/legs";
import type { TransportMode } from "@/types";
import { fetchRouteDuration, formatDuration } from "@/lib/travel/providers";

// 두 task 사이의 leg 카드. 수단 선택 · 자동/수동 소요시간 · 재계산.
// onChange(updates) 는 to 쪽 task 의 transport_* 필드를 업데이트.

const MODE_OPTIONS: { value: TransportMode; label: string; emoji: string }[] = [
  { value: "car", label: "자가용", emoji: "🚗" },
  { value: "bus", label: "버스", emoji: "🚌" },
  { value: "taxi", label: "택시", emoji: "🚕" },
  { value: "train", label: "기차", emoji: "🚆" },
];

interface Props {
  leg: TaskLeg;
  onUpdateTask: (taskId: string, updates: Partial<{
    transport_mode: TransportMode | null;
    transport_duration_sec: number | null;
    transport_manual: boolean;
  }>) => void;
}

export default function PlanLegCard({ leg, onUpdateTask }: Props) {
  const { toTask } = leg;
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState<string>(
    toTask.transport_manual && toTask.transport_duration_sec != null
      ? String(Math.round(toTask.transport_duration_sec / 60))
      : ""
  );

  const hasCoords =
    leg.fromTask.place_lat != null &&
    leg.fromTask.place_lng != null &&
    leg.toTask.place_lat != null &&
    leg.toTask.place_lng != null;

  const calculate = async (mode: TransportMode) => {
    if (!hasCoords) return;
    setLoading(true);
    const result = await fetchRouteDuration(
      { lat: leg.fromTask.place_lat!, lng: leg.fromTask.place_lng! },
      { lat: leg.toTask.place_lat!, lng: leg.toTask.place_lng! },
      mode
    );
    setLoading(false);
    // 실패 시에도 duration 을 null 로 리셋 — 이전 수단의 값이 새 수단 선택 후
    // 잔존해 "같은 시간" 으로 보이는 현상 방지
    onUpdateTask(toTask.id, {
      transport_mode: mode,
      transport_duration_sec: result?.durationSec ?? null,
      transport_manual: false,
    });
  };

  const onSelectMode = (mode: TransportMode) => {
    if (toTask.transport_manual) {
      // 수동 모드에서는 수단만 바꾸고 duration은 유지
      onUpdateTask(toTask.id, { transport_mode: mode });
    } else {
      calculate(mode);
    }
  };

  const toggleManual = () => {
    const next = !toTask.transport_manual;
    if (next) {
      // 수동 전환
      onUpdateTask(toTask.id, { transport_manual: true });
    } else {
      // 자동 전환 — 현재 수단으로 재계산
      if (toTask.transport_mode) calculate(toTask.transport_mode);
      else onUpdateTask(toTask.id, { transport_manual: false });
    }
  };

  const commitManual = () => {
    const n = parseInt(manualInput, 10);
    if (!Number.isFinite(n) || n < 0) return;
    onUpdateTask(toTask.id, {
      transport_duration_sec: n * 60,
      transport_manual: true,
    });
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-muted/30 px-2.5 py-2 ml-6">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          {MODE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onSelectMode(o.value)}
              className={`h-7 px-2 rounded text-xs transition-colors ${
                toTask.transport_mode === o.value
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent"
              }`}
              aria-label={o.label}
              title={o.label}
            >
              <span className="mr-0.5">{o.emoji}</span>
              <span className="hidden sm:inline">{o.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {toTask.transport_manual ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onBlur={commitManual}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitManual();
              }}
              className="h-7 w-16 rounded-md border bg-background px-2 text-xs outline-none"
              placeholder="분"
            />
            <span className="text-xs text-muted-foreground">분</span>
          </div>
        ) : (
          <span className="text-xs font-medium">
            {loading
              ? "계산 중…"
              : toTask.transport_duration_sec != null
                ? formatDuration(toTask.transport_duration_sec)
                : hasCoords
                  ? "수단 선택"
                  : "좌표 없음"}
          </span>
        )}

        {toTask.transport_mode && !toTask.transport_manual && hasCoords && (
          <button
            type="button"
            onClick={() => calculate(toTask.transport_mode!)}
            disabled={loading}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
            aria-label="다시 계산"
            title="다시 계산"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}

        <button
          type="button"
          onClick={toggleManual}
          className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          title="자동/수동 전환"
        >
          {toTask.transport_manual ? "자동" : "수동"}
        </button>
      </div>
    </div>
  );
}

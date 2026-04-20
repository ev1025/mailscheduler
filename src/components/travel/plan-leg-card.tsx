"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Zap } from "lucide-react";
import type { TaskLeg } from "@/lib/travel/legs";
import type { TransportMode } from "@/types";
import { fetchRouteDuration, formatDuration } from "@/lib/travel/providers";

// 두 task 사이의 leg 카드.
// - 좌표가 있으면 4개 수단(자가용/버스/택시/기차) 병렬 호출 → 한눈에 비교
// - 각 행: 수단 · 소요시간 · 예상 도착시간
// - 최속 수단에 ⚡ 배지, 택시는 "요금별도" 힌트
// - 행 클릭 → 해당 수단을 이 구간의 선택 수단으로 저장 (transport_mode)
// - 상단에 수동 토글: ON 이면 분 단위 직접 입력
// - 결과는 DB 의 transport_durations (JSONB) 에 캐시 — 재방문 시 즉시 표시

// 자가용·택시는 동일한 도로 경로를 쓰므로 "승용차" 하나로 통합 표시.
// DB 상 transport_mode="taxi" 인 기존 데이터도 승용차로 매칭되어 표시되도록
// selectMode 에선 항상 "car" 로 저장.
const MODES: { value: TransportMode; label: string; emoji: string }[] = [
  { value: "walk", label: "도보", emoji: "🚶" },
  { value: "car", label: "승용차", emoji: "🚗" },
  { value: "bus", label: "버스", emoji: "🚌" },
  { value: "train", label: "기차", emoji: "🚆" },
];

type ModeState = number | null | "loading";

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

function addMinutes(hhmm: string, addMin: number): string {
  const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
  const total = h * 60 + m + addMin;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function PlanLegCard({ leg, legDeparture, onUpdateTask }: Props) {
  const { fromTask, toTask } = leg;
  const hasCoords =
    fromTask.place_lat != null &&
    fromTask.place_lng != null &&
    toTask.place_lat != null &&
    toTask.place_lng != null;

  const cached = toTask.transport_durations ?? {};
  const [modeDurations, setModeDurations] = useState<Record<TransportMode, ModeState>>(() => ({
    car: cached.car ?? (hasCoords ? "loading" : null),
    walk: cached.walk ?? (hasCoords ? "loading" : null),
    bus: cached.bus ?? (hasCoords ? "loading" : null),
    train: cached.train ?? (hasCoords ? "loading" : null),
    taxi: null, // UI 비노출 — 하위호환만
  }));
  const [manualInput, setManualInput] = useState<string>(
    toTask.transport_manual && toTask.transport_duration_sec != null
      ? String(Math.round(toTask.transport_duration_sec / 60))
      : ""
  );

  // 좌표 기반으로 4개 수단 병렬 조회. 이미 캐시된 값(number/null)은 건드리지 않음.
  useEffect(() => {
    if (!hasCoords) return;
    let cancelled = false;
    const from = { lat: fromTask.place_lat!, lng: fromTask.place_lng! };
    const to = { lat: toTask.place_lat!, lng: toTask.place_lng! };

    const toFetch = MODES.filter((m) => modeDurations[m.value] === "loading");
    if (toFetch.length === 0) return;

    // 모두 완료되면 DB 한 번만 업데이트 (N 회 update 호출 방지)
    (async () => {
      const results = await Promise.all(
        toFetch.map((m) =>
          fetchRouteDuration(from, to, m.value)
            .then((r) => [m.value, r?.durationSec ?? null] as const)
            .catch(() => [m.value, null] as const)
        )
      );
      if (cancelled) return;
      const patch: Partial<Record<TransportMode, number | null>> = {};
      for (const [mode, sec] of results) patch[mode] = sec;
      setModeDurations((prev) => ({ ...prev, ...patch }));

      // DB 캐시 반영 — 컬럼 없으면 상위 supabase 레이어에서 에러 삼킴(옵셔널)
      const next = { ...(toTask.transport_durations ?? {}), ...patch };
      onUpdateTask(toTask.id, { transport_durations: next });
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTask.place_lat, fromTask.place_lng, toTask.place_lat, toTask.place_lng]);

  // 가장 빠른 수단
  const fastestMode = useMemo(() => {
    let best: TransportMode | null = null;
    let min = Infinity;
    for (const m of MODES) {
      const d = modeDurations[m.value];
      if (typeof d === "number" && d > 0 && d < min) {
        min = d;
        best = m.value;
      }
    }
    return best;
  }, [modeDurations]);

  const selectMode = (mode: TransportMode) => {
    const d = modeDurations[mode];
    onUpdateTask(toTask.id, {
      transport_mode: mode,
      transport_duration_sec: typeof d === "number" ? d : null,
      transport_manual: false,
    });
  };

  const toggleManual = () => {
    const next = !toTask.transport_manual;
    if (next) {
      onUpdateTask(toTask.id, { transport_manual: true });
    } else {
      onUpdateTask(toTask.id, { transport_manual: false });
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

  // 수동 모드: 단일 입력만 표시
  if (toTask.transport_manual) {
    return (
      <div className="flex flex-col gap-1.5 rounded-md bg-muted/30 px-2.5 py-2 ml-6">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            {legDeparture ? `출발 ${legDeparture}` : "출발 --:--"}
          </span>
          <button
            type="button"
            onClick={toggleManual}
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            자동으로
          </button>
        </div>
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
            className="h-7 w-20 rounded-md border bg-background px-2 text-xs outline-none"
            placeholder="소요(분)"
          />
          <span className="text-xs text-muted-foreground">분 (수동)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-muted/30 px-2.5 py-2 ml-6">
      {/* 헤더: 출발 시각 + 수동 토글 */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {legDeparture ? (
            <>출발 <span className="font-semibold tabular-nums text-foreground">{legDeparture}</span></>
          ) : (
            "출발 --:--"
          )}
        </span>
        <button
          type="button"
          onClick={toggleManual}
          className="text-[10px] text-muted-foreground hover:text-foreground underline"
          title="직접 입력"
        >
          수동
        </button>
      </div>

      {/* 비교 리스트 */}
      {!hasCoords ? (
        <div className="text-xs text-muted-foreground py-1">좌표 없음 — 경로 계산 불가</div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {MODES.map((m) => {
            const d = modeDurations[m.value];
            const selected = toTask.transport_mode === m.value;
            const isFastest = fastestMode === m.value && !selected;
            const arrival =
              legDeparture && typeof d === "number"
                ? addMinutes(legDeparture, Math.max(1, Math.round(d / 60)))
                : null;
            const durationLabel =
              d === "loading" ? "계산 중…" : d === null ? "실패" : formatDuration(d);

            return (
              <button
                key={m.value}
                type="button"
                onClick={() => selectMode(m.value)}
                className={`flex items-center gap-2 rounded px-1.5 py-1 text-xs text-left transition-colors ${
                  selected
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "hover:bg-accent"
                }`}
              >
                <span className="w-16 shrink-0">
                  <span className="mr-1">{m.emoji}</span>
                  <span>{m.label}</span>
                </span>
                <span
                  className={`w-16 shrink-0 tabular-nums ${
                    d === null ? "text-muted-foreground" : "font-medium"
                  }`}
                >
                  {durationLabel}
                </span>
                <span className="text-muted-foreground shrink-0">→</span>
                <span className="tabular-nums shrink-0 min-w-[3rem]">
                  {arrival ?? "--:--"}
                </span>
                {isFastest && (
                  <span className="ml-auto flex items-center gap-0.5 text-[10px] text-amber-600 font-medium shrink-0">
                    <Zap className="h-2.5 w-2.5 fill-amber-500 stroke-amber-600" />
                    최속
                  </span>
                )}
                {selected && (
                  <Check className="ml-auto h-3 w-3 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

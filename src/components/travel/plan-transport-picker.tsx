"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Zap, Edit3 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/lib/use-media-query";
import { fetchRouteDuration, formatDuration } from "@/lib/travel/providers";
import type { TransportMode } from "@/types";

// 이동수단 선택 모달 — 바텀시트(모바일) / Dialog(데스크탑).
// 열릴 때 4개 수단 병렬 fetch, 각 행에 소요·도착시간·⚡최속 표시.
// 행 클릭 → onSelect(mode, durationSec), 모달 닫힘.
// "수동 입력" 옵션도 제공.

const MODES: { value: TransportMode; label: string; emoji: string }[] = [
  { value: "walk", label: "도보", emoji: "🚶" },
  { value: "car", label: "승용차", emoji: "🚗" },
  { value: "bus", label: "버스", emoji: "🚌" },
  { value: "train", label: "기차", emoji: "🚆" },
];

type ModeState = number | null | "loading";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  legDeparture: string | null;
  // 현재 선택된 수단 (있으면 체크 표시)
  selectedMode: TransportMode | null;
  // 수단 선택 시 호출. allDurations = 이번 fetch 의 전체 결과 (DB 캐시 업데이트용)
  onSelect: (
    mode: TransportMode,
    durationSec: number | null,
    allDurations: Partial<Record<TransportMode, number | null>>
  ) => void;
  // 수동 입력 선택
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
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [durations, setDurations] = useState<Record<TransportMode, ModeState>>(() => ({
    walk: "loading",
    car: "loading",
    bus: "loading",
    train: "loading",
    taxi: null,
  }));

  // 열릴 때마다 항상 fresh fetch — 캐시된 값이 오래되거나 틀릴 수 있으므로
  // "계산 중..." 잠깐 보이더라도 정확한 현재 시간표 데이터 보장.
  // (API 비용은 Google $200 크레딧 + 네이버 월 6만건 내 여유 충분)
  useEffect(() => {
    if (!open) return;
    setDurations({
      walk: "loading",
      car: "loading",
      bus: "loading",
      train: "loading",
      taxi: null,
    });

    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        MODES.map((m) =>
          fetchRouteDuration(from, to, m.value)
            .then((r) => [m.value, r?.durationSec ?? null] as const)
            .catch(() => [m.value, null] as const)
        )
      );
      if (cancelled) return;
      setDurations((prev) => {
        const next = { ...prev };
        for (const [mode, sec] of results) next[mode] = sec;
        return next;
      });
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, from.lat, from.lng, to.lat, to.lng]);

  // 가장 빠른 수단
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

  const handleSelect = (mode: TransportMode) => {
    const d = durations[mode];
    const durationSec = typeof d === "number" ? d : null;
    // 모든 수단의 결과를 상위로 — DB 캐시 반영
    const all: Partial<Record<TransportMode, number | null>> = {};
    for (const m of MODES) {
      const v = durations[m.value];
      if (v === "loading") continue;
      all[m.value] = v;
    }
    onSelect(mode, durationSec, all);
  };

  const body = (
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
        const label =
          d === "loading" ? "계산 중…" :
          d === null ? "계산 실패" :
          formatDuration(d);

        return (
          <button
            key={m.value}
            type="button"
            onClick={() => handleSelect(m.value)}
            disabled={d === "loading"}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
              selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-accent"
            }`}
          >
            <span className="text-2xl shrink-0">{m.emoji}</span>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
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
            </div>
            {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        );
      })}

      <div className="border-t mt-1 pt-1">
        <button
          type="button"
          onClick={() => {
            onSelectManual();
          }}
          className="flex items-center gap-3 rounded-md px-3 py-2 w-full text-left text-xs text-muted-foreground hover:bg-accent"
        >
          <Edit3 className="h-3.5 w-3.5" />
          <span>수동으로 소요시간 직접 입력</span>
        </button>
      </div>
    </div>
  );

  const title = "이동수단 선택";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm">{title}</DialogTitle>
          </DialogHeader>
          {body}
          <div className="px-3 pb-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <DraggableSheet open={open} onOpenChange={onOpenChange} title={title}>
      {body}
    </DraggableSheet>
  );
}

// 공용 드래그 바텀시트 — 핸들 밀어 닫기 + 리스트 스크롤 가능.
// 리스트 영역에 overflow-y-auto + overscroll-contain 로 내부 스크롤 허용.
function DraggableSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);

  const onDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragStartY.current == null) return;
    const delta = e.clientY - dragStartY.current;
    setDragY(Math.max(0, delta));
  };
  const onUp = (e: React.PointerEvent) => {
    const delta = dragStartY.current != null ? e.clientY - dragStartY.current : 0;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragStartY.current = null;
    if (delta > 120) onOpenChange(false);
    setDragY(0);
  };

  useEffect(() => { if (!open) setDragY(0); }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)]"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragStartY.current == null ? "transform 150ms ease-out" : "none",
        }}
        showBackButton={false}
        showCloseButton={false}
      >
        <div className="mx-auto w-full max-w-md flex flex-col max-h-[80dvh]">
          <SheetHeader className="px-4 py-1.5 gap-1 shrink-0">
            <div
              className="flex justify-center py-1 -my-1 touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
            </div>
            <SheetTitle className="text-sm text-center">{title}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto overscroll-contain flex-1 min-h-0">
            {children}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// 수동 입력 전용 작은 다이얼로그
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, Copy } from "lucide-react";
import RowActionPopover from "@/components/ui/row-action-popover";
import SearchInput from "@/components/ui/search-input";
import PromptDialog from "@/components/ui/prompt-dialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useTravelPlans } from "@/hooks/use-travel-plans";
import type { TravelPlan } from "@/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ORDER_KEY = "travel_plan_custom_order";

function loadCustomOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveCustomOrder(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
  } catch {}
}

interface Props {
  onSelectPlan: (id: string) => void;
  newSignal?: number;
  /** 달력 탭 상단에서 선택된 "볼 사용자들" — 공유된 계획 포함 */
  visibleUserIds?: string[];
}

interface PlanCardProps {
  plan: TravelPlan;
  dragEnabled: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function PlanCard({ plan, dragEnabled, onSelect, onDelete, onDuplicate }: PlanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: plan.id, disabled: !dragEnabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // 드래그 바 없이 카드 전체가 드래그 타겟.
  // PointerSensor 의 distance=5 제약으로 단순 클릭은 onSelect, 5px 이상 이동 시
  // 드래그 시작 — click/drag 충돌 없음.
  const dragBindings = dragEnabled ? { ...attributes, ...listeners } : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...dragBindings}
      onClick={onSelect}
      className={`group relative rounded-lg border p-3 hover:bg-accent/50 transition-colors touch-none ${
        dragEnabled ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      <h3 className="text-sm font-semibold truncate pr-8">{plan.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {plan.start_date || plan.end_date
          ? `${plan.start_date ?? "-"} ~ ${plan.end_date ?? "-"}`
          : "기간 미정"}
      </p>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 md:opacity-0 md:group-hover:opacity-100 transition">
        <RowActionPopover
          trigger="more-h"
          triggerLabel="계획 메뉴"
          side="bottom"
          align="end"
          items={[
            {
              icon: <Copy className="h-3.5 w-3.5" />,
              label: "복제",
              onClick: onDuplicate,
            },
            {
              icon: <Trash2 className="h-3.5 w-3.5" />,
              label: "삭제",
              destructive: true,
              onClick: onDelete,
            },
          ]}
        />
      </div>
    </div>
  );
}

export default function PlanList({ onSelectPlan, newSignal, visibleUserIds }: Props) {
  const { plans, loading, addPlan, deletePlan, duplicatePlan } = useTravelPlans(visibleUserIds);
  const [newOpen, setNewOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [customOrder, setCustomOrder] = useState<string[]>([]);

  useEffect(() => {
    setCustomOrder(loadCustomOrder());
  }, []);

  useEffect(() => {
    if (newSignal && newSignal > 0) setNewOpen(true);
  }, [newSignal]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // 검색 필터 (제목·기간 부분 일치)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((p) => {
      if (p.title.toLowerCase().includes(q)) return true;
      if ((p.start_date ?? "").includes(q)) return true;
      if ((p.end_date ?? "").includes(q)) return true;
      return false;
    });
  }, [plans, search]);

  // 기본 정렬: start_date 오름차순 (null 은 뒤로). 사용자 드래그 순서가 있으면
  // customOrder 를 우선 적용. 검색 중이면 날짜순 유지(드래그 비활성).
  const ordered = useMemo(() => {
    if (search.trim() || customOrder.length === 0) {
      return [...filtered].sort((a, b) => {
        const aHas = !!a.start_date;
        const bHas = !!b.start_date;
        if (aHas && bHas) return a.start_date!.localeCompare(b.start_date!);
        if (aHas) return -1;
        if (bHas) return 1;
        return a.title.localeCompare(b.title);
      });
    }
    const orderMap = new Map(customOrder.map((id, i) => [id, i]));
    return [...filtered].sort((a, b) => {
      const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      const aHas = !!a.start_date;
      const bHas = !!b.start_date;
      if (aHas && bHas) return a.start_date!.localeCompare(b.start_date!);
      if (aHas) return -1;
      if (bHas) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [filtered, customOrder, search]);

  const dragEnabled = !search.trim();

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = ordered.map((p) => p.id);
    const oldIdx = ids.indexOf(e.active.id as string);
    const newIdx = ids.indexOf(e.over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(ids, oldIdx, newIdx);
    // customOrder 에 현재 필터 외 항목 보존
    const currentSet = new Set(ids);
    const preserved = customOrder.filter((id) => !currentSet.has(id));
    const next = [...reordered, ...preserved];
    for (const id of ids) if (!next.includes(id)) next.push(id);
    setCustomOrder(next);
    saveCustomOrder(next);
  };

  return (
    // 모바일: 부모(main) 이 fixed h-dvh 내부 스크롤이므로 h-full + flex 체인 유지.
    // 데스크탑: document 스크롤이므로 h/overflow 제거, 자연 흐름.
    <div className="flex flex-col h-full md:h-auto">
      {/* 상단 검색 — sticky */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur p-3 border-b">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="계획 제목·날짜 검색"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:flex-none md:overflow-visible">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-8">불러오는 중…</p>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <p className="text-sm text-muted-foreground">
              {plans.length === 0
                ? "아직 계획이 없습니다"
                : "검색 결과가 없습니다"}
            </p>
            {plans.length === 0 && (
              <p className="text-xs text-muted-foreground/70">
                우상단 + 버튼을 눌러 첫 여행 계획을 세워보세요
              </p>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ordered.map((p) => p.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ordered.map((p) => (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    dragEnabled={dragEnabled}
                    onSelect={() => onSelectPlan(p.id)}
                    onDelete={() => setDeletingId(p.id)}
                    onDuplicate={async () => {
                      await duplicatePlan(p.id);
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <PromptDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        title="새 여행 계획"
        placeholder="예: 제주 4박5일"
        confirmLabel="만들기"
        onConfirm={async (title) => {
          const { data } = await addPlan({ title });
          if (data) onSelectPlan(data.id);
        }}
      />

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(o) => {
          if (!o) setDeletingId(null);
        }}
        title="여행 계획 삭제"
        description="계획 안의 모든 일정도 함께 삭제됩니다."
        confirmLabel="삭제"
        destructive
        onConfirm={async () => {
          if (deletingId) await deletePlan(deletingId);
          setDeletingId(null);
        }}
      />
    </div>
  );
}

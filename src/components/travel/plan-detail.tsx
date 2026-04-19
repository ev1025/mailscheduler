"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NaverMap from "@/components/travel/naver-map";
import PlanTaskRow from "@/components/travel/plan-task-row";
import { useTravelPlans } from "@/hooks/use-travel-plans";
import { useTravelPlanTasks } from "@/hooks/use-travel-plan-tasks";
import type { TravelPlanTask } from "@/types";

interface Props {
  planId: string;
  onBack: () => void;
}

export default function PlanDetail({ planId, onBack }: Props) {
  const { plans, updatePlan } = useTravelPlans();
  const plan = plans.find((p) => p.id === planId);
  const { tasks, addTask, updateTask, deleteTask } = useTravelPlanTasks(planId);

  const [titleDraft, setTitleDraft] = useState<string | null>(null);

  // 지도 중심: 선택된 task 들 중 첫 번째 좌표 (없으면 서울시청)
  const center = useMemo(() => {
    const withCoord = tasks.find((t) => t.place_lat != null && t.place_lng != null);
    if (withCoord) return { lat: withCoord.place_lat!, lng: withCoord.place_lng! };
    return { lat: 37.5665, lng: 126.978 };
  }, [tasks]);

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">계획을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const handleAddRow = async () => {
    await addTask({
      plan_id: planId,
      day_index: 0,
      start_time: null,
      place_name: "",
      place_address: null,
      place_lat: null,
      place_lng: null,
      tag: null,
      content: null,
      stay_minutes: 0,
      manual_order: tasks.length,
      transport_mode: null,
      transport_duration_sec: null,
      transport_manual: false,
    });
  };

  const handleTitleCommit = async () => {
    if (titleDraft == null) return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== plan.title) {
      await updatePlan(plan.id, { title: trimmed });
    }
    setTitleDraft(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <header className="flex items-center gap-2 border-b px-3 h-14 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground -ml-1"
          aria-label="계획 목록으로"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {titleDraft != null ? (
          <Input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleCommit();
              if (e.key === "Escape") setTitleDraft(null);
            }}
            className="h-9 flex-1 text-base font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={() => setTitleDraft(plan.title)}
            className="flex-1 text-left text-base font-semibold truncate hover:text-muted-foreground"
          >
            {plan.title}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* 지도 (Phase A: 단순 전체 뷰 — 첫 장소 중심) */}
        <div className="p-3 border-b">
          <NaverMap lat={center.lat} lng={center.lng} height={220} zoom={12} />
        </div>

        {/* 일정 테이블 */}
        <div className="flex flex-col gap-2 p-3">
          {tasks.map((t: TravelPlanTask) => (
            <PlanTaskRow
              key={t.id}
              task={t}
              onChange={(updates) => updateTask(t.id, updates)}
              onDelete={() => deleteTask(t.id)}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            className="self-start h-8 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> 새 일정
          </Button>
        </div>
      </div>
    </div>
  );
}

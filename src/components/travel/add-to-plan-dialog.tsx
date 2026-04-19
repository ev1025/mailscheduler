"use client";

import { useState } from "react";
import { Plus, Route } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTravelPlans } from "@/hooks/use-travel-plans";
import { useTravelPlanTasks } from "@/hooks/use-travel-plan-tasks";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { TravelItem } from "@/types";

// 여행 카드의 메뉴에서 열림. 기존 계획 선택 또는 새 계획 생성 →
// 현재 여행 항목의 places[] 를 tasks 로 일괄 insert.
// 새 일자로 삽입(현재 계획의 max day_index + 1).

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  travelItem: TravelItem | null;
  onDone?: (planId: string) => void;
}

export default function AddToPlanDialog({ open, onOpenChange, travelItem, onDone }: Props) {
  const { plans, addPlan } = useTravelPlans();
  const [mode, setMode] = useState<"pick" | "new">("pick");
  const [newTitle, setNewTitle] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 선택된 plan 을 useTravelPlanTasks 로 다시 hook 걸기보다,
  // 한 번만 조회해서 max day_index 파악 후 bulk insert.
  const injectPlaces = async (planId: string) => {
    if (!travelItem) return;
    const places = travelItem.places ?? [];

    // 기존 tasks 에서 max day_index + 1 을 새 day 로
    const { data: existing } = await supabase
      .from("travel_plan_tasks")
      .select("day_index")
      .eq("plan_id", planId)
      .order("day_index", { ascending: false })
      .limit(1);
    const nextDay =
      existing && existing.length > 0 ? (existing[0].day_index as number) + 1 : 0;

    // 장소 없으면 빈 일정 1개 생성 (사용자가 계획 안에서 장소 직접 입력)
    const rows =
      places.length === 0
        ? [
            {
              plan_id: planId,
              day_index: nextDay,
              start_time: null,
              place_name: travelItem.title,
              place_address: null,
              place_lat: null,
              place_lng: null,
              tag: travelItem.category,
              content: null,
              stay_minutes: 0,
              manual_order: 0,
              transport_mode: null,
              transport_duration_sec: null,
              transport_manual: false,
            },
          ]
        : places.map((p, i) => ({
            plan_id: planId,
            day_index: nextDay,
            start_time: null,
            place_name: p.name,
            place_address: p.address,
            place_lat: p.lat,
            place_lng: p.lng,
            tag: travelItem.category,
            content: i === 0 ? travelItem.title : null,
            stay_minutes: 0,
            manual_order: i,
            transport_mode: null,
            transport_duration_sec: null,
            transport_manual: false,
          }));

    const { error } = await supabase.from("travel_plan_tasks").insert(rows);
    if (error) {
      toast.error("일정 추가 실패");
      return;
    }
    if (places.length === 0) {
      toast.info("위치 없이 빈 일정을 추가했습니다. 계획에서 장소를 입력하세요.");
    } else {
      toast.success(`${places.length}개 장소를 계획에 추가했습니다`);
    }
    onDone?.(planId);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!travelItem) return;
    setSaving(true);
    try {
      if (mode === "new") {
        const title = newTitle.trim() || travelItem.title;
        const { data } = await addPlan({ title });
        if (data) await injectPlaces(data.id);
      } else {
        if (!selectedPlanId) {
          toast.error("계획을 선택하세요");
          return;
        }
        await injectPlaces(selectedPlanId);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!travelItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-4 w-4" /> 여행 계획에 추가
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{travelItem.title}</span>
          {(travelItem.places?.length ?? 0) > 0
            ? ` 에 저장된 장소 ${travelItem.places!.length}개가 선택한 계획에 새 일자로 추가됩니다.`
            : " 에 저장된 장소가 없어 빈 일정만 추가됩니다. 계획에서 장소를 직접 입력할 수 있습니다."}
        </p>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "pick" ? "default" : "outline"}
            onClick={() => setMode("pick")}
            className="flex-1 h-8 text-xs"
          >
            기존 계획
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "new" ? "default" : "outline"}
            onClick={() => setMode("new")}
            className="flex-1 h-8 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" /> 새 계획
          </Button>
        </div>

        {mode === "pick" ? (
          plans.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              계획이 없습니다. &quot;새 계획&quot;으로 만드세요.
            </p>
          ) : (
            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    selectedPlanId === p.id
                      ? "border-primary bg-primary/10"
                      : "hover:bg-accent/40"
                  }`}
                >
                  <div className="text-sm font-medium truncate">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.start_date || p.end_date
                      ? `${p.start_date ?? "-"} ~ ${p.end_date ?? "-"}`
                      : "기간 미정"}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={`예: ${travelItem.title} 일정`}
            className="h-9 text-sm"
          />
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={saving || (mode === "pick" && !selectedPlanId)}
          >
            {saving ? "추가 중…" : "추가"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Plane, Route } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import HeaderViewMenu from "@/components/layout/header-view-menu";
import PlanList from "@/components/travel/plan-list";
import { useVisibleUserIds } from "@/hooks/use-visible-user-ids";

export default function TravelPlansPage() {
  const router = useRouter();
  const { visibleUserIds } = useVisibleUserIds();
  // "+ 새 계획" 아이콘 → PlanList 내부 다이얼로그 트리거 신호
  const [newSignal, setNewSignal] = useState(0);

  return (
    <>
      <PageHeader
        title="여행 계획"
        actions={
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setNewSignal((n) => n + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
              aria-label="새 계획"
              title="새 계획"
            >
              <Plus className="h-[22px] w-[22px]" strokeWidth={1.6} />
            </button>
            <HeaderViewMenu
              items={[
                {
                  key: "travel",
                  label: "여행",
                  icon: Plane,
                  onSelect: () => router.push("/travel"),
                },
                {
                  key: "travel-plans",
                  label: "여행 계획",
                  icon: Route,
                  active: true,
                  onSelect: () => {},
                },
              ]}
            />
          </div>
        }
      />
      <div className="flex flex-col h-[calc(100%-3.5rem)] overflow-hidden px-2 py-2 md:h-auto md:overflow-visible md:min-h-0 md:p-6">
        <PlanList
          visibleUserIds={visibleUserIds}
          newSignal={newSignal}
          onSelectPlan={(id) => router.push(`/travel/plans/${id}`)}
        />
      </div>
    </>
  );
}

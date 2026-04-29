"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Plane, Route } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import HeaderViewMenu from "@/components/layout/header-view-menu";
import PlanList from "@/components/travel/plan-list";
import PlanDetail from "@/components/travel/plan-detail";
import { useVisibleUserIds } from "@/hooks/use-visible-user-ids";

/**
 * 여행 계획 페이지 — 목록 / 상세를 같은 라우트에서 ?id 쿼리로 토글.
 *
 * 이전엔 /travel/plans (목록) 와 /travel/plans/[planId] (상세) 가 분리된 라우트라
 * 카드 탭 시 페이지 전체가 unmount/remount → "리로드" 처럼 보였음.
 * 이제 같은 페이지 안에서 쿼리 파라미터만 바뀌어 PageHeader/AppShell 이 유지됨.
 */
export default function TravelPlansPage() {
  return (
    <Suspense fallback={null}>
      <TravelPlansPageInner />
    </Suspense>
  );
}

function TravelPlansPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("id");
  const { visibleUserIds } = useVisibleUserIds();
  const [newSignal, setNewSignal] = useState(0);

  // 상세 모드 — query 만 바뀌므로 페이지 자체는 그대로 유지.
  if (planId) {
    return (
      <div className="flex flex-col min-h-0">
        <PlanDetail
          planId={planId}
          onBack={() => router.push("/travel/plans", { scroll: false })}
        />
      </div>
    );
  }

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
          onSelectPlan={(id) =>
            router.replace(`/travel/plans?id=${id}`, { scroll: false })
          }
        />
      </div>
    </>
  );
}

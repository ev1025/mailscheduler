"use client";

import { useParams, useRouter } from "next/navigation";
import PlanDetail from "@/components/travel/plan-detail";

export default function TravelPlanDetailPage() {
  const router = useRouter();
  const params = useParams<{ planId: string }>();
  const planId = params?.planId;

  if (!planId) {
    // 방어 코드 — 동적 라우트 특성상 planId 는 항상 존재하지만 타입 내로잉용.
    return null;
  }

  return (
    <div className="flex flex-col min-h-0">
      <PlanDetail
        planId={planId}
        onBack={() => router.push("/travel/plans")}
      />
    </div>
  );
}

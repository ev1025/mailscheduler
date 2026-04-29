"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * 옛 라우트 호환 — /travel/plans/[planId] 는 모두 /travel/plans?id=... 로 redirect.
 * 페이지 분리되어 있던 시절의 북마크/공유 링크 보존용. 이후 모든 진입은 한 페이지(query) 모드로.
 */
export default function TravelPlanDetailRedirect() {
  const router = useRouter();
  const params = useParams<{ planId: string }>();
  const planId = params?.planId;

  useEffect(() => {
    if (planId) {
      router.replace(`/travel/plans?id=${planId}`, { scroll: false });
    } else {
      router.replace("/travel/plans");
    }
  }, [planId, router]);

  return null;
}

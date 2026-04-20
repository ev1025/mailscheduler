"use client";

import { useEffect, useState } from "react";
import { Calendar, Trash2 } from "lucide-react";
import PromptDialog from "@/components/ui/prompt-dialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useTravelPlans } from "@/hooks/use-travel-plans";

interface Props {
  onSelectPlan: (id: string) => void;
  // calendar/page.tsx 의 PageHeader 액션(햄버거 옆 +)에서 호출하는 신호
  newSignal?: number;
}

export default function PlanList({ onSelectPlan, newSignal }: Props) {
  const { plans, loading, addPlan, deletePlan } = useTravelPlans();
  const [newOpen, setNewOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 상위에서 newSignal 이 바뀌면 다이얼로그 열림
  useEffect(() => {
    if (newSignal && newSignal > 0) setNewOpen(true);
  }, [newSignal]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-8">불러오는 중…</p>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/40" strokeWidth={1.4} />
            <p className="text-sm text-muted-foreground">
              아직 계획이 없습니다. 우상단 + 버튼을 눌러 시작하세요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {plans.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectPlan(p.id)}
                className="group relative rounded-lg border p-3 hover:bg-accent/40 cursor-pointer transition-colors"
              >
                <h3 className="text-sm font-semibold truncate">{p.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.start_date || p.end_date
                    ? `${p.start_date ?? "-"} ~ ${p.end_date ?? "-"}`
                    : "기간 미정"}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingId(p.id);
                  }}
                  // 모바일: 항상 노출 (호버 없음)
                  // 데스크탑(md+): hover 시에만 노출
                  className="absolute top-2 right-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition md:opacity-0 md:group-hover:opacity-100"
                  aria-label="계획 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
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
        onOpenChange={(o) => { if (!o) setDeletingId(null); }}
        title="계획 삭제"
        description="계획과 그 안의 모든 일정이 삭제됩니다."
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

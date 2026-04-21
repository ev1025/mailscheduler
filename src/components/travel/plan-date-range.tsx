"use client";

import { X } from "lucide-react";
import DatePicker from "@/components/ui/date-picker";

// 여행 계획 상세의 기간 선택 바.
// 시작·종료 date picker + (종료 지울 수 있는 X 버튼) + 박/일 요약.

interface Props {
  startDate: string | null;
  endDate: string | null;
  totalDays: number; // 박/일 표시용 (end_date 있어야 > 0)
  onChangeStart: (iso: string | null) => void;
  onChangeEnd: (iso: string | null) => void;
}

export default function PlanDateRange({
  startDate,
  endDate,
  totalDays,
  onChangeStart,
  onChangeEnd,
}: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b">
      <span className="text-xs text-muted-foreground shrink-0">기간</span>
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <DatePicker
          value={startDate ?? ""}
          onChange={(v) => onChangeStart(v || null)}
          className="h-8 min-w-0 text-xs flex-1 md:flex-none md:w-36"
        />
        <span className="text-xs text-muted-foreground shrink-0">~</span>
        <DatePicker
          value={endDate ?? ""}
          onChange={(v) => onChangeEnd(v || null)}
          min={startDate ?? undefined}
          className="h-8 min-w-0 text-xs flex-1 md:flex-none md:w-36"
        />
        {endDate && (
          <button
            type="button"
            onClick={() => onChangeEnd(null)}
            className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
            aria-label="종료일 제거"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {totalDays > 0 && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {totalDays - 1}박 {totalDays}일
        </span>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import type { Expense } from "@/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface TransactionListProps {
  transactions: Expense[];
  onEdit: (tx: Expense) => void;
  onDelete: (id: string) => void;
}

function formatWon(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

export default function TransactionList({
  transactions,
  onEdit,
  onDelete,
}: TransactionListProps) {
  // 삭제 확인 다이얼로그 — 실수로 영구 삭제 방지.
  const [deletingTx, setDeletingTx] = useState<Expense | null>(null);
  // 날짜별로 그룹화
  const grouped = transactions.reduce(
    (acc, tx) => {
      if (!acc[tx.date]) acc[tx.date] = [];
      acc[tx.date].push(tx);
      return acc;
    },
    {} as Record<string, Expense[]>
  );

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col gap-6">
      {sortedDates.map((date) => (
        <div key={date}>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            {format(new Date(date + "T00:00:00"), "M월 d일 (EEEE)", {
              locale: ko,
            })}
          </h3>
          <div className="flex flex-col gap-2">
            {grouped[date].map((tx) => (
              <div
                key={tx.id}
                role="button"
                tabIndex={0}
                onClick={() => onEdit(tx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onEdit(tx);
                }}
                className="group flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent/50 active:bg-accent"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {tx.category && (
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs shrink-0"
                      style={{ backgroundColor: tx.category.color }}
                    >
                      {tx.category.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {tx.category?.name || "미분류"}
                      {tx.description && (
                        <span className="ml-2 text-muted-foreground font-normal">
                          {tx.description}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.payment_method}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-semibold text-sm ${
                      tx.type === "income" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatWon(tx.amount)}
                  </span>
                  {/* 휴지통: 연한 회색. 행 클릭으로는 편집으로 가니 삭제만 별도 버튼. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingTx(tx);
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-colors"
                    aria-label="거래 삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <ConfirmDialog
        open={!!deletingTx}
        onOpenChange={(o) => { if (!o) setDeletingTx(null); }}
        title="거래 삭제"
        description={
          deletingTx
            ? `"${deletingTx.category?.name || "미분류"}${deletingTx.description ? ` · ${deletingTx.description}` : ""}" 거래를 삭제합니다. 이 작업은 되돌릴 수 없어요.`
            : ""
        }
        confirmLabel="삭제"
        destructive
        onConfirm={async () => {
          if (deletingTx) onDelete(deletingTx.id);
          setDeletingTx(null);
        }}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import DeleteRecordDescription from "@/components/ui/delete-record-description";
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
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {tx.category && (
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                      style={{
                        backgroundColor: tx.category.color + "20",
                        color: tx.category.color,
                      }}
                    >
                      {tx.category.name.charAt(0)}
                    </div>
                  )}
                  {/* 제목(title) 이 제일 크게. 카테고리는 그 아래 작게.
                      title 없으면 description → 카테고리명 순으로 폴백.
                      할부 항목은 카테고리 옆에 작은 배지 추가. */}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {tx.title || tx.description || tx.category?.name || "미분류"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {(tx.title || tx.description) && tx.category?.name && (
                        <span className="text-xs text-muted-foreground truncate">
                          {tx.category.name}
                        </span>
                      )}
                      {tx.installment_total && tx.installment_total > 1 && (
                        <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                          할부 {tx.installment_total}개월
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-semibold text-sm tabular-nums ${
                      tx.type === "income" ? "text-finance-gain" : "text-finance-loss"
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
        title={
          deletingTx
            ? `${deletingTx.title || deletingTx.description || deletingTx.category?.name || "이 거래"} 삭제`
            : "삭제"
        }
        description={
          deletingTx ? (
            <DeleteRecordDescription
              fields={[
                {
                  label: "일자",
                  value: format(new Date(deletingTx.date + "T00:00:00"), "yyyy년 M월 d일 (EEE)", { locale: ko }),
                  valueClassName: "tabular-nums",
                },
                {
                  label: "금액",
                  value: `${deletingTx.type === "income" ? "+" : "-"}${formatWon(deletingTx.amount)}`,
                  valueClassName: `tabular-nums ${deletingTx.type === "income" ? "text-finance-gain" : "text-finance-loss"}`,
                },
                ...(deletingTx.category?.name
                  ? [{ label: "카테고리", value: deletingTx.category.name }]
                  : []),
              ]}
              footnote={
                deletingTx.installment_id && deletingTx.installment_total && deletingTx.installment_total > 1
                  ? `${deletingTx.installment_total}개월 할부 묶음이라 모든 회차가 함께 삭제돼요.`
                  : undefined
              }
            />
          ) : null
        }
        confirmLabel="삭제"
        destructive
        onConfirm={async () => {
          if (deletingTx) await onDelete(deletingTx.id);
          setDeletingTx(null);
        }}
      />
    </div>
  );
}

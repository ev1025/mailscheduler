"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
                className="group flex items-center justify-between rounded-lg border p-3"
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
                  <div className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => onEdit(tx)}
                      aria-label="거래 수정"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onDelete(tx.id)}
                      aria-label="거래 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

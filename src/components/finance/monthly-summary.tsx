"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Pencil } from "lucide-react";
import { useAppSetting } from "@/hooks/use-app-settings";
import { useFixedExpenses } from "@/hooks/use-fixed-expenses";

interface MonthlySummaryProps {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

function formatWon(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

export default function MonthlySummary({
  totalIncome,
  totalExpense,
  balance,
}: MonthlySummaryProps) {
  const { value: incomeStr, saveValue: saveIncome } = useAppSetting(
    "monthly_income",
    "0"
  );
  const monthlyIncome = parseInt(incomeStr) || 0;
  const { fixedExpenses } = useFixedExpenses();
  const totalFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0);
  const disposable = monthlyIncome - totalFixed;

  const [editingIncome, setEditingIncome] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft(String(monthlyIncome));
  }, [monthlyIncome]);

  const Cell = ({
    label,
    value,
    color,
    icon,
    editable,
  }: {
    label: string;
    value: React.ReactNode;
    color?: string;
    icon?: React.ReactNode;
    editable?: boolean;
  }) => (
    <div className="rounded-lg border bg-card p-2.5 md:p-3 flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] md:text-xs text-muted-foreground truncate">
          {label}
        </span>
        {editable ? (
          <button
            type="button"
            onClick={() => setEditingIncome((v) => !v)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <Pencil className="h-3 w-3" />
          </button>
        ) : (
          icon
        )}
      </div>
      <div className={`text-sm md:text-xl font-bold truncate ${color || ""}`}>
        {value}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 md:gap-4">
      {/* 1층: 월급 / 고정비 / 여윳돈 */}
      <div className="grid gap-2 md:gap-3 grid-cols-3">
        <Cell
          label="월급"
          editable
          value={
            editingIncome ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveIncome(draft);
                      setEditingIncome(false);
                    }
                  }}
                  autoFocus
                  className="h-7 text-xs w-full min-w-0"
                />
                <button
                  type="button"
                  onClick={() => {
                    saveIncome(draft);
                    setEditingIncome(false);
                  }}
                  className="text-[10px] text-primary shrink-0"
                >
                  OK
                </button>
              </div>
            ) : (
              formatWon(monthlyIncome)
            )
          }
        />
        <Cell
          label="고정비"
          color="text-orange-600"
          value={`-${formatWon(totalFixed)}`}
        />
        <Cell
          label="여윳돈"
          icon={<PiggyBank className="h-3 w-3 text-green-500 shrink-0" />}
          color={disposable >= 0 ? "text-green-600" : "text-red-600"}
          value={formatWon(disposable)}
        />
      </div>

      {/* 2층: 실제 수입/지출/잔액 */}
      <div className="grid gap-2 md:gap-3 grid-cols-3">
        <Cell
          label="이번달 수입"
          icon={<TrendingUp className="h-3 w-3 text-green-500 shrink-0" />}
          color="text-green-600"
          value={`+${formatWon(totalIncome)}`}
        />
        <Cell
          label="이번달 지출"
          icon={<TrendingDown className="h-3 w-3 text-red-500 shrink-0" />}
          color="text-red-600"
          value={`-${formatWon(totalExpense)}`}
        />
        <Cell
          label="잔액"
          icon={<Wallet className="h-3 w-3 text-blue-500 shrink-0" />}
          color={balance >= 0 ? "text-blue-600" : "text-red-600"}
          value={formatWon(balance)}
        />
      </div>
    </div>
  );
}

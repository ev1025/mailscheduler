"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Pencil, Plus } from "lucide-react";
import { useAppSetting } from "@/hooks/use-app-settings";
import { useFixedExpenses } from "@/hooks/use-fixed-expenses";

interface MonthlySummaryProps {
  totalIncome: number;
  totalExpense: number;
  /** 고정비 카드 우상단 ✏️ — 클릭 시 FixedExpenseManager 열기. */
  onOpenFixed?: () => void;
  /** 수입/지출 카드 우상단 + — 거래 폼을 해당 type 으로 미리 세팅한 채 열기. */
  onAddTransaction?: (type: "income" | "expense") => void;
}

function formatWon(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

export default function MonthlySummary({
  totalIncome,
  totalExpense,
  onOpenFixed,
  onAddTransaction,
}: MonthlySummaryProps) {
  const { value: incomeStr, saveValue: saveIncome } = useAppSetting(
    "monthly_income",
    "0"
  );
  const monthlyIncome = parseInt(incomeStr) || 0;
  const { fixedExpenses } = useFixedExpenses();
  const totalFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0);

  const [editingIncome, setEditingIncome] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft(String(monthlyIncome));
  }, [monthlyIncome]);

  // 카드 우상단 액션 버튼 — Pencil/Plus 등 임의 아이콘 + onClick. 카드 자체에
  // 의미 있는 액션을 직접 박아 페이지 헤더 액션 버튼을 비움.
  const ActionBtn = ({
    icon,
    onClick,
    label,
  }: {
    icon: React.ReactNode;
    onClick: () => void;
    label: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="-mr-1 flex h-8 w-8 items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors shrink-0"
    >
      {icon}
    </button>
  );

  const Cell = ({
    label,
    value,
    color,
    action,
  }: {
    label: string;
    value: React.ReactNode;
    color?: string;
    action?: React.ReactNode;
  }) => (
    <div className="rounded-lg border bg-card p-2.5 md:p-3 flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] md:text-xs text-muted-foreground truncate">
          {label}
        </span>
        {action}
      </div>
      <div className={`text-sm md:text-base font-semibold truncate tabular-nums ${color || "text-foreground"}`}>
        {value}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 md:gap-3">
      {/* 1층: 월급 | 고정비 — 각 카드 우상단에 ✏️ 액션 */}
      <div className="grid gap-2 md:gap-3 grid-cols-2">
        <Cell
          label="월급"
          action={
            <ActionBtn
              icon={<Pencil className="h-3 w-3" />}
              onClick={() => setEditingIncome((v) => !v)}
              label="월급 편집"
            />
          }
          value={
            editingIncome ? (
              <Input
                type="number"
                inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  saveIncome(draft);
                  setEditingIncome(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    saveIncome(draft);
                    setEditingIncome(false);
                  }
                  if (e.key === "Escape") setEditingIncome(false);
                }}
                autoFocus
                className="h-7 text-xs w-full min-w-0"
              />
            ) : (
              formatWon(monthlyIncome)
            )
          }
        />
        <Cell
          label="고정비"
          color="text-foreground"
          action={
            onOpenFixed ? (
              <ActionBtn
                icon={<Pencil className="h-3 w-3" />}
                onClick={onOpenFixed}
                label="고정비 관리"
              />
            ) : undefined
          }
          value={`-${formatWon(totalFixed)}`}
        />
      </div>

      {/* 2층: 이번달 수입 | 지출 — 각 카드 우상단에 + 액션 (해당 type 으로 폼 열림) */}
      <div className="grid gap-2 md:gap-3 grid-cols-2">
        <Cell
          label="이번달 수입"
          color="text-finance-gain"
          action={
            onAddTransaction ? (
              <ActionBtn
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => onAddTransaction("income")}
                label="수입 추가"
              />
            ) : undefined
          }
          value={`+${formatWon(totalIncome)}`}
        />
        <Cell
          label="이번달 지출"
          color="text-finance-loss"
          action={
            onAddTransaction ? (
              <ActionBtn
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => onAddTransaction("expense")}
                label="지출 추가"
              />
            ) : undefined
          }
          value={`-${formatWon(totalExpense)}`}
        />
      </div>
    </div>
  );
}

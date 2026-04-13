"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  return (
    <div className="flex flex-col gap-4">
      {/* 1층: 월급 / 고정비 / 여윳돈 */}
      <div className="grid gap-3 grid-cols-3">
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              월급
            </CardTitle>
            <button
              type="button"
              onClick={() => setEditingIncome((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent>
            {editingIncome ? (
              <div className="flex gap-1">
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
                  className="h-7 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    saveIncome(draft);
                    setEditingIncome(false);
                  }}
                  className="text-xs text-primary"
                >
                  OK
                </button>
              </div>
            ) : (
              <p className="text-xl font-bold text-foreground">
                {formatWon(monthlyIncome)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              이 달 고정비
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-orange-600">
              -{formatWon(totalFixed)}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              여윳돈
            </CardTitle>
            <PiggyBank className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent>
            <p
              className={`text-xl font-bold ${
                disposable >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatWon(disposable)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2층: 실제 수입/지출/잔액 */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              이번달 수입
            </CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">
              +{formatWon(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              이번달 지출
            </CardTitle>
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">
              -{formatWon(totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              잔액
            </CardTitle>
            <Wallet className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p
              className={`text-xl font-bold ${
                balance >= 0 ? "text-blue-600" : "text-red-600"
              }`}
            >
              {formatWon(balance)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

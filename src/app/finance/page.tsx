"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Wallet, ShoppingBag, Menu } from "lucide-react";
import MonthPicker from "@/components/layout/month-picker";
import PageHeader from "@/components/layout/page-header";
import { useTransactions } from "@/hooks/use-transactions";
import { useFixedExpenses } from "@/hooks/use-fixed-expenses";
import MonthlySummary from "@/components/finance/monthly-summary";
import TransactionList from "@/components/finance/transaction-list";
import TransactionForm from "@/components/finance/transaction-form";
import CategoryChart from "@/components/finance/category-chart";
import FixedExpenseManager from "@/components/finance/fixed-expense-manager";
import type { Expense } from "@/types";

export default function FinancePage() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [formOpen, setFormOpen] = useState(false);
  const [finMenuOpen, setFinMenuOpen] = useState(false);
  const finMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!finMenuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (finMenuRef.current && !finMenuRef.current.contains(e.target as Node)) setFinMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [finMenuOpen]);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [fixedOpen, setFixedOpen] = useState(false);
  /** 카드 +수입 / +지출 클릭 시 폼 type 미리 세팅용. 신규 작성 시에만 의미. */
  const [formDefaultType, setFormDefaultType] = useState<"income" | "expense">("expense");


  const handleYearChange = (y: number) => {
    setYear(y);
  };
  const handleMonthChange = (m: number) => {
    setMonth(m);
  };

  const {
    transactions, categories, loading: txLoading,
    addTransaction, addInstallment, updateTransaction, deleteTransaction,
    addCategory, deleteCategory, updateCategoryColor,
    totalIncome, totalExpense, expenseByCategory,
    refetch: refetchTransactions,
  } = useTransactions(year, month);

  const {
    fixedExpenses,
    loading: fxLoading,
    addFixed,
    updateFixed,
    deleteFixed,
    applyFixedToMonth,
  } = useFixedExpenses();

  // 월 진입 시 고정비를 실제 거래로 자동 반영 — 이전의 "확정 저장" 수동 단계 제거.
  // applyFixedToMonth 내부에서 (amount·description·date) 중복 체크 후 insert 하므로
  // 재호출되어도 중복 생성되지 않는다. appliedKey ref 로 한 번만 시도하도록 가드.
  const appliedKey = useRef<string>("");
  useEffect(() => {
    if (txLoading || fxLoading) return;
    if (fixedExpenses.length === 0) return;
    const key = `${year}-${month}`;
    if (appliedKey.current === key) return;
    appliedKey.current = key;
    void (async () => {
      const count = await applyFixedToMonth(year, month, transactions);
      if (count > 0) await refetchTransactions();
    })();
  }, [year, month, fixedExpenses, txLoading, fxLoading, transactions, applyFixedToMonth, refetchTransactions]);

  // 고정비 등록/수정/삭제 후 현재 월에 다시 자동 적용될 수 있게 key 리셋.
  // fixedExpenses 배열 자체가 바뀌면 다음 useEffect 때 재적용됨.
  useEffect(() => {
    appliedKey.current = "";
  }, [fixedExpenses]);

  const allTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = async (
    data: {
      title: string | null;
      amount: number; category_id: string; description: string | null;
      date: string; type: "income" | "expense"; payment_method: string;
    },
    installmentMonths?: number
  ) => {
    if (editing) return await updateTransaction(editing.id, data);
    if (installmentMonths && installmentMonths >= 2) {
      return await addInstallment(data, installmentMonths);
    }
    return await addTransaction(data);
  };

  return (
    <>
      <PageHeader
        title="가계부"
        actions={
          <div className="relative" ref={finMenuRef}>
            <button
              type="button"
              onClick={() => setFinMenuOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
              aria-label="메뉴"
            >
              <Menu className="h-[22px] w-[22px]" strokeWidth={1.6} />
            </button>
            {finMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border bg-popover p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => setFinMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm bg-accent font-medium"
                  >
                    <Wallet className="h-4 w-4" /> 가계부
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFinMenuOpen(false); router.push("/products"); }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent/50"
                  >
                    <ShoppingBag className="h-4 w-4" /> 쇼핑기록
                  </button>
                </div>
            )}
          </div>
        }
      />
    <div className="flex flex-col h-[calc(100%-3.5rem)]">
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-3 flex justify-center">
        <MonthPicker year={year} month={month} onYearChange={handleYearChange} onMonthChange={handleMonthChange} />
      </div>

      {/* 페이지 상단의 [고정비] [+ 추가] 버튼은 제거. 액션은 MonthlySummary
          각 카드 우상단의 ✏️ / + 아이콘으로 직접 수행. */}

      {(
        <div className="flex flex-col gap-6">
          <MonthlySummary
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            onOpenFixed={() => setFixedOpen(true)}
            onAddTransaction={(t) => {
              setEditing(null);
              setFormDefaultType(t);
              setFormOpen(true);
            }}
          />
          <CategoryChart expenseByCategory={expenseByCategory} totalExpense={totalExpense} />
          {txLoading ? (
            <div className="py-12" aria-hidden />
          ) : allTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm text-muted-foreground">이 달의 내역이 없습니다</p>
              <p className="text-xs text-muted-foreground/70 break-keep">위 카드의 + 아이콘으로 수입·지출을 기록해보세요</p>
            </div>
          ) : (
            <TransactionList
              transactions={allTransactions}
              onEdit={(tx) => { setEditing(tx); setFormOpen(true); }}
              onDelete={async (id) => { await deleteTransaction(id); }}
            />
          )}
        </div>
      )}

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        transaction={editing}
        defaultType={formDefaultType}
        onSave={handleSave}
        onAddCategory={addCategory}
        onDeleteCategory={deleteCategory}
        onUpdateCategoryColor={updateCategoryColor}
      />
      <FixedExpenseManager
        open={fixedOpen}
        onOpenChange={setFixedOpen}
        fixedExpenses={fixedExpenses}
        categories={categories}
        onAdd={addFixed}
        onUpdate={updateFixed}
        onDelete={deleteFixed}
        onAddCategory={addCategory}
        onDeleteCategory={deleteCategory}
        onUpdateCategoryColor={updateCategoryColor}
      />
    </div>
    </div>
    </>
  );
}

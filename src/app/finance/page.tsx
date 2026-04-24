"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Wallet, ShoppingBag, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import MonthPicker from "@/components/layout/month-picker";
import EmptyIllustration from "@/components/ui/illustrations";
import PageHeader from "@/components/layout/page-header";
import { useTransactions } from "@/hooks/use-transactions";
import { useFixedExpenses } from "@/hooks/use-fixed-expenses";
import MonthlySummary from "@/components/finance/monthly-summary";
import TransactionList from "@/components/finance/transaction-list";
import TransactionForm from "@/components/finance/transaction-form";
import CategoryChart from "@/components/finance/category-chart";
import FixedExpenseManager from "@/components/finance/fixed-expense-manager";
import { PAGE_ACTION_BUTTON } from "@/lib/form-classes";
import type { Expense } from "@/types";
import { toast } from "sonner";

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


  const handleYearChange = (y: number) => {
    setYear(y);
  };
  const handleMonthChange = (m: number) => {
    setMonth(m);
  };

  const {
    transactions, categories,
    addTransaction, updateTransaction, deleteTransaction,
    addCategory, deleteCategory, updateCategoryColor,
    totalIncome, totalExpense, balance, expenseByCategory,
  } = useTransactions(year, month);

  const { fixedExpenses, addFixed, updateFixed, deleteFixed, applyFixedToMonth } = useFixedExpenses();

  // 고정비 가상 거래
  const fixedAsTransactions: Expense[] = fixedExpenses.map((fx) => {
    const day = Math.min(fx.day_of_month, new Date(year, month, 0).getDate());
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const exists = transactions.some((t) => t.amount === fx.amount && t.description === fx.description && t.date === date);
    if (exists) return null;
    return {
      id: `fixed-${fx.id}`, amount: fx.amount, category_id: fx.category_id,
      description: fx.description ? `[고정] ${fx.description}` : "[고정비]",
      date, type: fx.type, payment_method: fx.payment_method,
      created_at: "", category: fx.category,
    } as Expense;
  }).filter(Boolean) as Expense[];

  const allTransactions = [...transactions, ...fixedAsTransactions].sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = async (data: {
    amount: number; category_id: string; description: string | null;
    date: string; type: "income" | "expense"; payment_method: string;
  }) => {
    if (editing) return await updateTransaction(editing.id, data);
    return await addTransaction(data);
  };

  const handleApplyFixed = async () => {
    const count = await applyFixedToMonth(year, month, transactions);
    if (count > 0) {
      window.location.reload();
    } else {
      toast.info("추가할 고정비가 없습니다 (이미 등록됨)");
    }
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

      {/* 버튼 행 */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" className={PAGE_ACTION_BUTTON} onClick={() => setFixedOpen(true)}>
          고정비
        </Button>
        <Button size="sm" className={PAGE_ACTION_BUTTON} onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" />
          추가
        </Button>
      </div>

      {/* 고정비 미적용 안내 — 현재 [고정] 표시는 미리보기일 뿐이고 실제 거래로는 확정되지 않은 상태. */}
      {fixedAsTransactions.length > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-dashed p-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium">
              고정비 {fixedAsTransactions.length}건 미적용
            </p>
            <p className="text-[10px] text-muted-foreground leading-snug">
              [고정] 표시는 미리보기입니다. "확정 저장"을 눌러야 실제 거래 내역으로 기록돼요.
            </p>
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={handleApplyFixed}>
            확정 저장
          </Button>
        </div>
      )}

      {(
        <div className="flex flex-col gap-6">
          <MonthlySummary
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            balance={balance}
          />
          <CategoryChart expenseByCategory={expenseByCategory} totalExpense={totalExpense} />
          {allTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <EmptyIllustration variant="finance" size={150} />
              <p className="text-sm text-muted-foreground">이 달의 내역이 없습니다</p>
              <p className="text-xs text-muted-foreground/70">우상단 + 버튼으로 수입·지출을 기록해보세요</p>
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
        onSave={handleSave}
        onAddCategory={addCategory}
        onDeleteCategory={deleteCategory}
        onUpdateCategoryColor={updateCategoryColor}
      />
      <FixedExpenseManager open={fixedOpen} onOpenChange={setFixedOpen} fixedExpenses={fixedExpenses} categories={categories} onAdd={addFixed} onUpdate={updateFixed} onDelete={deleteFixed} />
    </div>
    </div>
    </>
  );
}

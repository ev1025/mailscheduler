"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Wallet, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

export default function FinancePage() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [formOpen, setFormOpen] = useState(false);
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
      <PageHeader title="가계부" />
    <div className="flex flex-col h-[calc(100%-3.5rem)]">
      {/* 탭: 가계부 / 생필품 */}
      <div className="flex border-b shrink-0 px-2">
        <button
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 border-primary text-foreground"
        >
          <Wallet className="h-3.5 w-3.5" />
          가계부
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/products")}
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          생필품
        </button>
      </div>
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-3 flex justify-center">
        <MonthPicker year={year} month={month} onYearChange={handleYearChange} onMonthChange={handleMonthChange} />
      </div>

      {/* 버튼 행 */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" className="h-8" onClick={() => setFixedOpen(true)}>
          고정비
        </Button>
        <Button size="sm" className="h-8" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" />
          추가
        </Button>
      </div>

      {/* 고정비 미적용 안내 */}
      {fixedAsTransactions.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            고정비 {fixedAsTransactions.length}건 미적용 ([고정]으로 표시 중)
          </p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleApplyFixed}>
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
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">이 달의 내역이 없습니다</p>
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

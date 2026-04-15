"use client";

import { useState } from "react";
import { Plus, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import MonthPicker from "@/components/layout/month-picker";
import DatePicker from "@/components/ui/date-picker";
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
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [fixedOpen, setFixedOpen] = useState(false);

  // 날짜 필터
  const lastDay = new Date(year, month, 0).getDate();
  const defaultFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const defaultTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [filterOpen, setFilterOpen] = useState(false);

  const handleYearChange = (y: number) => {
    setYear(y);
    const ld = new Date(y, month, 0).getDate();
    setDateFrom(`${y}-${String(month).padStart(2, "0")}-01`);
    setDateTo(`${y}-${String(month).padStart(2, "0")}-${String(ld).padStart(2, "0")}`);
  };
  const handleMonthChange = (m: number) => {
    setMonth(m);
    const ld = new Date(year, m, 0).getDate();
    setDateFrom(`${year}-${String(m).padStart(2, "0")}-01`);
    setDateTo(`${year}-${String(m).padStart(2, "0")}-${String(ld).padStart(2, "0")}`);
  };

  const {
    transactions, categories, loading,
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
  const filteredTransactions = allTransactions.filter((t) => t.date >= dateFrom && t.date <= dateTo);
  const filteredIncome = filteredTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const filteredExpense = filteredTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const isFiltered = dateFrom !== defaultFrom || dateTo !== defaultTo;

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
    <div className="p-4 md:p-6">
      {/* 상단: MonthPicker 중앙 */}
      <div className="mb-3 flex justify-center">
        <MonthPicker year={year} month={month} onYearChange={handleYearChange} onMonthChange={handleMonthChange} />
      </div>

      {/* 버튼 행: 오른쪽 정렬 */}
      <div className="mb-4 flex items-center justify-end gap-2">
        {/* 날짜 필터 */}
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger className="flex items-center gap-1.5 rounded-md border px-3 h-9 text-sm hover:bg-accent transition-colors cursor-pointer">
            <CalendarRange className={`h-3.5 w-3.5 ${isFiltered ? "text-blue-600" : "text-muted-foreground"}`} />
            {isFiltered ? `${dateFrom} ~ ${dateTo}` : "날짜 필터"}
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-3" align="end" side="bottom">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground">기간 선택</p>
              <div className="flex items-center gap-2">
                <DatePicker value={dateFrom} onChange={setDateFrom} className="h-8 flex-1" placeholder="시작일" />
                <span className="text-xs text-muted-foreground">~</span>
                <DatePicker value={dateTo} onChange={setDateTo} min={dateFrom} className="h-8 flex-1" placeholder="종료일" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                  setDateFrom(defaultFrom); setDateTo(defaultTo); setFilterOpen(false);
                }}>초기화</Button>
                <Button size="sm" className="flex-1" onClick={() => setFilterOpen(false)}>적용</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* 고정비 관리 */}
        <Button size="sm" variant="outline" className="h-8" onClick={() => setFixedOpen(true)}>
          고정비
        </Button>

        {/* 추가 */}
        <Button size="sm" className="h-8" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="mr-1 h-3.5 w-3.5" />
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

      {loading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : (
        <div className="flex flex-col gap-6">
          <MonthlySummary
            totalIncome={isFiltered ? filteredIncome : totalIncome}
            totalExpense={isFiltered ? filteredExpense : totalExpense}
            balance={isFiltered ? filteredIncome - filteredExpense : balance}
          />
          <CategoryChart expenseByCategory={expenseByCategory} totalExpense={totalExpense} />
          {filteredTransactions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">{isFiltered ? "해당 기간의 내역이 없습니다" : "이 달의 내역이 없습니다"}</p>
            </div>
          ) : (
            <TransactionList
              transactions={filteredTransactions}
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
  );
}

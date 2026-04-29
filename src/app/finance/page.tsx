"use client";

import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Wallet, ShoppingBag, Menu, X, Check } from "lucide-react";
import DateRangePicker from "@/components/layout/date-range-picker";
import PageHeader from "@/components/layout/page-header";
import { useTransactions } from "@/hooks/use-transactions";
import { useFixedExpenses } from "@/hooks/use-fixed-expenses";
import { useUrlStringParam } from "@/hooks/use-url-param";
import MonthlySummary from "@/components/finance/monthly-summary";
import TransactionList from "@/components/finance/transaction-list";
import TransactionForm from "@/components/finance/transaction-form";
import CategoryChart from "@/components/finance/category-chart";
import FixedExpenseManager from "@/components/finance/fixed-expense-manager";
import type { Expense } from "@/types";

export default function FinancePage() {
  return (
    <Suspense fallback={null}>
      <FinancePageInner />
    </Suspense>
  );
}

function FinancePageInner() {
  const router = useRouter();
  const now = new Date();

  // 시작일/종료일 — 기본은 이번 달 1일~말일. URL 에 ?s=YYYY-MM-DD&e=YYYY-MM-DD 동기화.
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultEnd = (() => {
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  })();
  const [startDate, setStartDate] = useUrlStringParam("s", defaultStart);
  const [endDate, setEndDate] = useUrlStringParam("e", defaultEnd);

  // 고정비 자동 적용 시 사용할 (year, month) — startDate 가 속한 달 기준.
  const startObj = new Date(startDate + "T00:00:00");
  const year = startObj.getFullYear();
  const month = startObj.getMonth() + 1;

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

  const handleRangeChange = (s: string, e: string) => {
    setStartDate(s);
    setEndDate(e);
  };

  const {
    transactions, categories, loading: txLoading,
    addTransaction, addInstallment, updateTransaction, deleteTransaction,
    addCategory, deleteCategory, updateCategoryColor,
    totalIncome, totalExpense, expenseByCategory,
    refetch: refetchTransactions,
  } = useTransactions(startDate, endDate);

  const {
    fixedExpenses,
    loading: fxLoading,
    addFixed,
    updateFixed,
    deleteFixed,
    deleteFixedWithScope,
    updateFixedWithScope,
    ensureFixedMonths,
    applyFixedToMonth,
  } = useFixedExpenses();

  // monthly-summary 가 자체 훅 인스턴스를 쓰면 변경이 즉시 반영 안 되므로
  // 여기서 합계 계산해 prop 으로 내려보냄.
  const totalFixed = useMemo(
    () => fixedExpenses.reduce((s, f) => s + f.amount, 0),
    [fixedExpenses],
  );

  // 자동 적용 useEffect 제거 — 페이지 마운트마다 트리거되어 사용자가 수동으로
  // 거래를 지워도 다음 진입 시 다시 등록되는 문제 + 고정비 삭제 후 재추가 시 중복
  // 등록되는 문제의 근본 원인이었음. 이제 사용자가 명시적으로 트리거 (고정비 추가 시
  // 다이얼로그, 또는 매니저의 "이번달 자동 적용" 버튼) 할 때만 적용됨.

  const allTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  // 카테고리 차트 클릭으로 설정되는 필터. null = 전체.
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  // 고정비에서 자동 등록된 거래 포함 여부 (여행 "가본곳 포함" 토글 패턴 차용).
  const [includeFixed, setIncludeFixed] = useState(true);

  // 어떤 거래가 고정비에서 자동 등록된 것인지 판별 — applyFixedToMonth 가
  // amount + description 동일하게 insert 하므로 그 조합으로 매칭.
  // (false-positive 가능성 있으나 실용상 충분.)
  const fixedSet = useMemo(() => {
    const s = new Set<string>();
    for (const fx of fixedExpenses) {
      s.add(`${fx.amount}|${fx.description ?? ""}`);
    }
    return s;
  }, [fixedExpenses]);

  const isFromFixed = (tx: Expense) => fixedSet.has(`${tx.amount}|${tx.description ?? ""}`);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      if (categoryFilter && tx.category?.name !== categoryFilter) return false;
      if (!includeFixed && isFromFixed(tx)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTransactions, categoryFilter, includeFixed, fixedSet]);

  // 필터링된 거래의 합계 (UI 표시용)
  const filteredTotal = useMemo(
    () => filteredTransactions.reduce((sum, tx) => sum + (tx.type === "expense" ? tx.amount : 0), 0),
    [filteredTransactions],
  );

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
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={handleRangeChange} />
      </div>

      {/* 페이지 상단의 [고정비] [+ 추가] 버튼은 제거. 액션은 MonthlySummary
          각 카드 우상단의 ✏️ / + 아이콘으로 직접 수행. */}

      {(
        <div className="flex flex-col gap-3 md:gap-4">
          {/* 데스크탑(md+): 좌 스코어카드 / 우 카테고리 차트 2단. 모바일: 세로 스택. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 md:items-stretch">
            <MonthlySummary
              totalIncome={totalIncome}
              totalExpense={totalExpense}
              totalFixed={totalFixed}
              onOpenFixed={() => setFixedOpen(true)}
              onAddTransaction={(t) => {
                setEditing(null);
                setFormDefaultType(t);
                setFormOpen(true);
              }}
            />
            <CategoryChart
              expenseByCategory={expenseByCategory}
              totalExpense={totalExpense}
              onSelectCategory={setCategoryFilter}
              activeCategory={categoryFilter}
            />
          </div>

          {/* 거래 목록 헤더 — 한 줄에 [필터 칩 + 건수·합계] | [고정비 포함 체크박스]
              항상 노출되어 정보 일관. 필터 칩은 카테고리 색을 적용해 차트와 시각 연결. */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {categoryFilter && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter(null)}
                  aria-label={`${categoryFilter} 필터 해제`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: (expenseByCategory[categoryFilter]?.color || "#6B7280") + "1A",
                    borderColor: (expenseByCategory[categoryFilter]?.color || "#6B7280") + "55",
                    color: expenseByCategory[categoryFilter]?.color || "#6B7280",
                  }}
                >
                  {categoryFilter}
                  <X className="h-3 w-3 opacity-70" />
                </button>
              )}
              <span className="text-xs text-muted-foreground tabular-nums truncate">
                총 {filteredTransactions.length}건
                {filteredTotal > 0 && (
                  <> · {new Intl.NumberFormat("ko-KR").format(filteredTotal)}원</>
                )}
              </span>
            </div>

            {/* 고정비 포함 체크박스 — 명시적 의미. Pin 아이콘 메타포 모호함 제거. */}
            <button
              type="button"
              onClick={() => setIncludeFixed((v) => !v)}
              aria-pressed={includeFixed}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 h-7 text-xs hover:bg-accent/50 transition-colors"
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded border-[1.5px] transition-colors ${
                  includeFixed
                    ? "bg-primary border-primary"
                    : "border-muted-foreground/40"
                }`}
              >
                {includeFixed && (
                  <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                )}
              </span>
              <span className={includeFixed ? "" : "text-muted-foreground"}>
                고정비 포함
              </span>
            </button>
          </div>

          {txLoading ? (
            <div className="py-12" aria-hidden />
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm text-muted-foreground">
                {categoryFilter || !includeFixed
                  ? "조건에 맞는 내역이 없습니다"
                  : "이 달의 내역이 없습니다"}
              </p>
              {!categoryFilter && includeFixed && (
                <p className="text-xs text-muted-foreground/70 break-keep">
                  위 카드의 + 아이콘으로 수입·지출을 기록해보세요
                </p>
              )}
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
        onAdd={async (item, repeatMonths) => {
          const r = await addFixed(item, repeatMonths);
          if (!r.error) await refetchTransactions();
          return r;
        }}
        onUpdate={async (id, updates) => {
          const r = await updateFixed(id, updates);
          if (!r.error) await refetchTransactions();
          return r;
        }}
        onDelete={async (id) => {
          const r = await deleteFixed(id);
          if (!r.error) await refetchTransactions();
          return r;
        }}
        onDeleteWithScope={async (id, scope, y, m) => {
          const r = await deleteFixedWithScope(id, scope, y, m);
          if (!r.error) await refetchTransactions();
          return r;
        }}
        onUpdateWithScope={async (id, updates, scope, y, m) => {
          const r = await updateFixedWithScope(id, updates, scope, y, m);
          if (!r.error) await refetchTransactions();
          return r;
        }}
        onEnsureFixedMonths={async (id, repeat) => {
          const r = await ensureFixedMonths(id, repeat);
          if (!r.error) await refetchTransactions();
          return r;
        }}
        onAddCategory={addCategory}
        onDeleteCategory={deleteCategory}
        onUpdateCategoryColor={updateCategoryColor}
      />
    </div>
    </div>
    </>
  );
}

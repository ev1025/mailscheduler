"use client";

import { useMemo, useState } from "react";
import FormPage from "@/components/ui/form-page";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, CalendarMinus, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FixedExpenseForm from "@/components/finance/fixed-expense-form";
import type { ExpenseCategory } from "@/types";
import type { FixedExpense } from "@/hooks/use-fixed-expenses";

type Scope = "this-month" | "next-month";

interface FixedExpenseManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixedExpenses: FixedExpense[];
  categories: ExpenseCategory[];
  onAdd: (
    item: Omit<FixedExpense, "id" | "created_at" | "category" | "is_active">,
    repeatMonths?: number,
  ) => Promise<{ error: unknown }>;
  onUpdate?: (
    id: string,
    updates: Partial<Omit<FixedExpense, "id" | "created_at" | "category">>
  ) => Promise<{ error: unknown }>;
  onDelete: (id: string) => Promise<{ error: unknown }>;
  /** 이번달 자동 적용된 거래까지 함께 삭제할지 선택. */
  onDeleteWithScope?: (
    id: string,
    scope: Scope,
    year: number,
    month: number,
  ) => Promise<{ error: unknown }>;
  /** 금액 변경 시 이번달 거래를 새 금액으로 갱신할지 선택. */
  onUpdateWithScope?: (
    id: string,
    updates: Partial<Omit<FixedExpense, "id" | "created_at" | "category">>,
    scope: Scope,
    year: number,
    month: number,
  ) => Promise<{ error: unknown }>;
  /** 수정 시 반복 N개월에 미래 거래가 부족하면 채워주는 콜백. dedup 포함. */
  onEnsureFixedMonths?: (
    id: string,
    repeatMonths: number,
  ) => Promise<{ error: unknown }>;
  onAddCategory?: (
    name: string,
    type: "income" | "expense",
    color: string
  ) => Promise<{ error: unknown }>;
  onDeleteCategory?: (id: string) => Promise<{ error: unknown }>;
  onUpdateCategoryColor?: (id: string, color: string) => Promise<{ error: unknown }>;
}

function formatWon(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

export default function FixedExpenseManager({
  open,
  onOpenChange,
  fixedExpenses,
  categories,
  onAdd,
  onUpdate,
  onDelete,
  onDeleteWithScope,
  onUpdateWithScope,
  onEnsureFixedMonths,
  onAddCategory,
  onDeleteCategory,
  onUpdateCategoryColor,
}: FixedExpenseManagerProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [deletingFx, setDeletingFx] = useState<FixedExpense | null>(null);
  // 금액 변경 적용 시점 다이얼로그 — editing 이 있고 amount 가 바뀌었을 때 트리거.
  const [pendingUpdate, setPendingUpdate] = useState<{
    oldFx: FixedExpense;
    newData: Parameters<NonNullable<FixedExpenseManagerProps["onUpdate"]>>[1];
    repeatMonths?: number;
  } | null>(null);
  // 카테고리별 펼침 상태 — 기본 닫힘. 펼친 그룹 id 만 Set 에 보관.
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // "이번달" 기준 — today.
  const today = new Date();
  const thisYear = today.getFullYear();
  const thisMonth = today.getMonth() + 1;

  // 카테고리별 그룹화. 카테고리명 → 항목 배열. 미분류는 "(미분류)" 키.
  const grouped = useMemo(() => {
    const g: Record<string, { color: string; items: FixedExpense[]; total: number }> = {};
    for (const fx of fixedExpenses) {
      const key = fx.category?.name || "(미분류)";
      const color = fx.category?.color || "#6B7280";
      if (!g[key]) g[key] = { color, items: [], total: 0 };
      g[key].items.push(fx);
      g[key].total += fx.type === "income" ? -fx.amount : fx.amount;
    }
    return g;
  }, [fixedExpenses]);

  // 정렬: 합계 큰 카테고리 위로.
  const sortedCats = useMemo(
    () => Object.entries(grouped).sort(([, a], [, b]) => b.total - a.total),
    [grouped],
  );

  const toggleCat = (name: string) => {
    setExpandedCats((p) => {
      const n = new Set(p);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });
  };

  const handleOpenNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (fx: FixedExpense) => {
    setEditing(fx);
    setFormOpen(true);
  };

  const handleSave = async (
    data: {
      title: string | null;
      amount: number;
      category_id: string;
      description: string | null;
      day_of_month: number;
      type: "income" | "expense";
      payment_method: string;
    },
    repeatMonths?: number,
  ) => {
    if (editing && onUpdate) {
      // 금액 또는 결제일이 바뀌면 scope 다이얼로그 (이번달/다음달부터). 미래 거래에도 전파됨.
      // repeatMonths 는 dialog 응답 후에도 ensureFixedMonths 호출에 사용.
      const txAffectingChange =
        data.amount !== editing.amount || data.day_of_month !== editing.day_of_month;
      if (onUpdateWithScope && txAffectingChange) {
        setPendingUpdate({ oldFx: editing, newData: data, repeatMonths });
        return { error: null };
      }
      // repeat_months 도 함께 갱신.
      const updateData = repeatMonths !== undefined
        ? { ...data, repeat_months: repeatMonths }
        : data;
      const r = await onUpdate(editing.id, updateData);
      // 반복이 1보다 크면 미래 거래 보장 (dedup 포함).
      if (
        !r.error &&
        repeatMonths !== undefined &&
        (repeatMonths > 1 || repeatMonths === -1) &&
        onEnsureFixedMonths
      ) {
        await onEnsureFixedMonths(editing.id, repeatMonths);
      }
      return r;
    }
    return await onAdd(data, repeatMonths);
  };

  const applyDeleteScope = async (scope: Scope) => {
    if (!deletingFx) return;
    if (onDeleteWithScope) {
      await onDeleteWithScope(deletingFx.id, scope, thisYear, thisMonth);
    } else {
      // 폴백: 기존 deleteFixed (이번달 자동 거래는 안 건드림)
      await onDelete(deletingFx.id);
    }
    setDeletingFx(null);
  };

  const applyUpdateScope = async (scope: Scope) => {
    if (!pendingUpdate || !onUpdateWithScope) return;
    // repeat_months 도 함께 보존.
    const newData = pendingUpdate.repeatMonths !== undefined
      ? { ...pendingUpdate.newData, repeat_months: pendingUpdate.repeatMonths }
      : pendingUpdate.newData;
    await onUpdateWithScope(
      pendingUpdate.oldFx.id,
      newData,
      scope,
      thisYear,
      thisMonth,
    );
    // 반복 N 이 있으면 미래 거래도 보장.
    if (
      pendingUpdate.repeatMonths !== undefined &&
      (pendingUpdate.repeatMonths > 1 || pendingUpdate.repeatMonths === -1) &&
      onEnsureFixedMonths
    ) {
      await onEnsureFixedMonths(pendingUpdate.oldFx.id, pendingUpdate.repeatMonths);
    }
    setPendingUpdate(null);
  };

  return (
    <>
      <FormPage
        open={open}
        onOpenChange={onOpenChange}
        title="고정비 관리"
        hideFooter
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground leading-relaxed break-keep">
            매월 자동 반영되는 고정 항목. 항목 탭으로 수정 · 휴지통으로 삭제.
          </p>

          {fixedExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              등록된 고정비가 없습니다
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {sortedCats.map(([catName, group]) => {
                const isOpen = expandedCats.has(catName);
                return (
                  <div
                    key={catName}
                    className={`rounded-lg border bg-card overflow-hidden transition-colors ${
                      isOpen ? "border-primary/40" : ""
                    }`}
                  >
                    {/* 카테고리 헤더 — 행 전체가 토글. 펼침 상태는 활성 테두리 색 +
                        펼쳐진 항목 자체로 시각화 (별도 화살표 없음). */}
                    <button
                      type="button"
                      onClick={() => toggleCat(catName)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="text-sm font-semibold flex-1 truncate">{catName}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {group.items.length}건
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-finance-loss shrink-0">
                        -{formatWon(group.total)}
                      </span>
                    </button>

                    {/* 카테고리 내부 항목들 — 펼쳐진 경우만 */}
                    {isOpen && (
                      <ul className="border-t divide-y divide-border/60">
                        {group.items.map((fx) => (
                          <li
                            key={fx.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpenEdit(fx)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleOpenEdit(fx);
                            }}
                            className="group flex items-center justify-between gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-accent/40"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-[13px] truncate">
                                {fx.title || fx.description || fx.category?.name || "미분류"}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                                <span>매월 {fx.day_of_month}일</span>
                                {fx.payment_method && <span>· {fx.payment_method}</span>}
                              </div>
                            </div>
                            <span
                              className={`text-sm font-semibold tabular-nums shrink-0 ${
                                fx.type === "income" ? "text-finance-gain" : "text-finance-loss"
                              }`}
                            >
                              {fx.type === "income" ? "+" : "-"}
                              {formatWon(fx.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingFx(fx);
                              }}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-colors"
                              aria-label="고정비 삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Button variant="outline" onClick={handleOpenNew}>
            <Plus className="mr-1 h-4 w-4" />
            고정비 추가
          </Button>
        </div>
      </FormPage>

      <FixedExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        fixed={editing}
        categories={categories}
        onSave={handleSave}
        onAddCategory={onAddCategory}
        onDeleteCategory={onDeleteCategory}
        onUpdateCategoryColor={onUpdateCategoryColor}
      />

      {/* 삭제 — "이번달부터 / 다음달부터" 선택 다이얼로그.
          이번달부터: 이번달 자동 등록된 거래도 삭제. 다음달부터: 이번달 거래는 유지. */}
      <ScopeChoiceDialog
        open={!!deletingFx}
        onOpenChange={(o) => {
          if (!o) setDeletingFx(null);
        }}
        title={
          deletingFx
            ? `${deletingFx.title || deletingFx.description || "고정비"} 삭제`
            : "고정비 삭제"
        }
        info={
          deletingFx ? (
            <>
              <span className="block">매월 {deletingFx.day_of_month}일 · {formatWon(deletingFx.amount)}</span>
              {deletingFx.category?.name && (
                <span className="block text-muted-foreground/70">{deletingFx.category.name}</span>
              )}
            </>
          ) : null
        }
        question="어느 시점부터 삭제할까요?"
        thisMonthLabel="이번달부터 삭제"
        thisMonthHint={`이번달(${thisMonth}월) 자동 등록된 거래도 함께 삭제`}
        nextMonthLabel="다음달부터 삭제"
        nextMonthHint="이번달 거래는 유지, 다음 달부터 자동 추가만 중지"
        destructive
        onPick={applyDeleteScope}
      />

      {/* 수정 — "이번달부터 / 다음달부터" 선택 다이얼로그. 변경 종류(금액/결제일/둘 다) 에 따라 문구 분기. */}
      {(() => {
        const u = pendingUpdate;
        const name = u
          ? u.oldFx.title || u.oldFx.description || "고정비"
          : "고정비";
        const amountChanged = !!u && u.newData.amount !== undefined && u.newData.amount !== u.oldFx.amount;
        const dayChanged = !!u && u.newData.day_of_month !== undefined && u.newData.day_of_month !== u.oldFx.day_of_month;

        let title = `${name} 수정`;
        let question = "어느 시점부터 적용할까요?";
        let info: React.ReactNode = null;
        let thisHint = `이번달(${thisMonth}월) 거래도 새 값으로 갱신`;
        let nextHint = "이번달 거래는 기존 값 유지, 다음달부터 새 값";

        if (u) {
          if (amountChanged && dayChanged) {
            title = `${name} 금액·결제일 변경`;
            question = "변경된 값을 어느 시점부터 적용할까요?";
            info = (
              <>
                <span className="block tabular-nums">
                  {formatWon(u.oldFx.amount)} → {formatWon(u.newData.amount ?? 0)}
                </span>
                <span className="block tabular-nums">
                  매월 {u.oldFx.day_of_month}일 → {u.newData.day_of_month}일
                </span>
              </>
            );
            thisHint = `이번달(${thisMonth}월) 거래의 금액·날짜도 새 값으로 갱신`;
            nextHint = "이번달 거래는 기존 값 유지, 다음달부터 새 값";
          } else if (amountChanged) {
            title = `${name} 금액 변경`;
            question = "변경된 금액을 어느 시점부터 적용할까요?";
            info = (
              <span className="block tabular-nums">
                {formatWon(u.oldFx.amount)} → {formatWon(u.newData.amount ?? 0)}
              </span>
            );
            thisHint = `이번달(${thisMonth}월) 자동 등록된 거래도 새 금액으로 갱신`;
            nextHint = "이번달 거래는 기존 금액 유지, 다음달부터 새 금액";
          } else if (dayChanged) {
            title = `${name} 결제일 변경`;
            question = "변경된 결제일을 어느 시점부터 적용할까요?";
            info = (
              <span className="block tabular-nums">
                매월 {u.oldFx.day_of_month}일 → {u.newData.day_of_month}일
              </span>
            );
            thisHint = `이번달(${thisMonth}월) 거래의 날짜도 새 결제일로 갱신`;
            nextHint = "이번달 거래는 기존 날짜 유지, 다음달부터 새 결제일";
          }
        }

        return (
          <ScopeChoiceDialog
            open={!!pendingUpdate}
            onOpenChange={(o) => {
              if (!o) setPendingUpdate(null);
            }}
            title={title}
            info={info}
            question={question}
            thisMonthLabel="이번달부터 적용"
            thisMonthHint={thisHint}
            nextMonthLabel="다음달부터 적용"
            nextMonthHint={nextHint}
            onPick={applyUpdateScope}
          />
        );
      })()}
    </>
  );
}

/* ── 이번달 / 다음달 선택 다이얼로그 ──
   카드형 옵션 버튼 (아이콘 + 라벨 + 힌트) → iOS Action Sheet 보다 시각 위계 명확.
   파괴적 액션(삭제) 은 destructive 톤, 일반(수정) 은 primary 톤. */
interface ScopeChoiceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  info?: React.ReactNode;
  question: string;
  thisMonthLabel: string;
  thisMonthHint: string;
  nextMonthLabel: string;
  nextMonthHint: string;
  destructive?: boolean;
  onPick: (scope: Scope) => void | Promise<void>;
}

function ScopeChoiceDialog({
  open,
  onOpenChange,
  title,
  info,
  question,
  thisMonthLabel,
  thisMonthHint,
  nextMonthLabel,
  nextMonthHint,
  destructive,
  onPick,
}: ScopeChoiceProps) {
  const [busy, setBusy] = useState(false);
  const handle = async (scope: Scope) => {
    setBusy(true);
    try {
      await onPick(scope);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  // 강조 색 토큰 — 파괴적 = destructive, 일반 = primary.
  const accentText = destructive ? "text-destructive" : "text-primary";
  const accentBorder = destructive ? "border-destructive/40 hover:border-destructive/70 hover:bg-destructive/5" : "border-primary/40 hover:border-primary/70 hover:bg-primary/5";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showBackButton={false}
        className="max-w-[calc(100%-3rem)] sm:max-w-md p-0 gap-0 overflow-hidden z-[80]"
      >
        {/* Header: 제목 + 정보 + 질문 */}
        <div className="px-5 pt-5 pb-3 flex flex-col items-center text-center gap-1.5">
          <DialogHeader className="contents">
            <DialogTitle className="text-base font-semibold leading-snug break-keep">
              {title}
            </DialogTitle>
          </DialogHeader>
          {info && <div className="text-[13px] text-foreground/80 leading-relaxed">{info}</div>}
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">{question}</p>
        </div>

        {/* 옵션 카드 — 2개 stacked. 아이콘 + 라벨 + 힌트. */}
        <div className="px-3 pb-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handle("this-month")}
            disabled={busy}
            className={cn(
              "flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all disabled:opacity-50",
              accentBorder,
            )}
          >
            <CalendarMinus className={cn("h-5 w-5 mt-0.5 shrink-0", accentText)} />
            <div className="flex-1 min-w-0">
              <div className={cn("text-sm font-semibold", accentText)}>{thisMonthLabel}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 break-keep leading-relaxed">
                {thisMonthHint}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handle("next-month")}
            disabled={busy}
            className="flex items-start gap-3 rounded-lg border-2 border-border/60 p-3 text-left transition-all hover:border-foreground/30 hover:bg-accent/40 disabled:opacity-50"
          >
            <CalendarClock className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{nextMonthLabel}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 break-keep leading-relaxed">
                {nextMonthHint}
              </div>
            </div>
          </button>
        </div>

        {/* 취소 — 푸터, 차분한 회색. */}
        <div className="border-t">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent/40 disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

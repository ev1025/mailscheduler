"use client";

import { useMemo, useState } from "react";
import FormPage from "@/components/ui/form-page";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import DeleteRecordDescription from "@/components/ui/delete-record-description";
import FixedExpenseForm from "@/components/finance/fixed-expense-form";
import type { ExpenseCategory } from "@/types";
import type { FixedExpense } from "@/hooks/use-fixed-expenses";

interface FixedExpenseManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixedExpenses: FixedExpense[];
  categories: ExpenseCategory[];
  onAdd: (
    item: Omit<FixedExpense, "id" | "created_at" | "category" | "is_active">
  ) => Promise<{ error: unknown }>;
  onUpdate?: (
    id: string,
    updates: Partial<Omit<FixedExpense, "id" | "created_at" | "category">>
  ) => Promise<{ error: unknown }>;
  onDelete: (id: string) => Promise<{ error: unknown }>;
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
  onAddCategory,
  onDeleteCategory,
  onUpdateCategoryColor,
}: FixedExpenseManagerProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [deletingFx, setDeletingFx] = useState<FixedExpense | null>(null);
  // 카테고리별 펼침 상태 — 기본 닫힘. 펼친 그룹 id 만 Set 에 보관.
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

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

  const handleSave = async (data: {
    title: string | null;
    amount: number;
    category_id: string;
    description: string | null;
    day_of_month: number;
    type: "income" | "expense";
    payment_method: string;
  }) => {
    if (editing && onUpdate) {
      return await onUpdate(editing.id, data);
    }
    return await onAdd(data);
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

      <ConfirmDialog
        open={!!deletingFx}
        onOpenChange={(o) => {
          if (!o) setDeletingFx(null);
        }}
        title={
          deletingFx
            ? `${deletingFx.title || deletingFx.description || "고정비"} 삭제`
            : "고정비 삭제"
        }
        description={
          deletingFx ? (
            <DeleteRecordDescription
              fields={[
                {
                  label: "결제일",
                  value: `매월 ${deletingFx.day_of_month}일`,
                  valueClassName: "tabular-nums",
                },
                {
                  label: "금액",
                  value: `${deletingFx.type === "income" ? "+" : "-"}${formatWon(deletingFx.amount)}`,
                  valueClassName: `tabular-nums ${deletingFx.type === "income" ? "text-finance-gain" : "text-finance-loss"}`,
                },
                ...(deletingFx.category?.name
                  ? [{ label: "카테고리", value: deletingFx.category.name }]
                  : []),
              ]}
              footnote="이미 반영된 거래는 유지, 다음 달부터 자동 추가만 중지돼요."
            />
          ) : null
        }
        confirmLabel="삭제"
        destructive
        // FormPage(z-[70]) 내부에서 띄우므로 z-[80] 으로 올려야 backdrop 위에 보임.
        // 이전엔 z-50 이라 FormPage 오버레이에 가려져 클릭 자체가 안 됐음.
        contentClassName="z-[80]"
        onConfirm={async () => {
          if (deletingFx) await onDelete(deletingFx.id);
          setDeletingFx(null);
        }}
      />
    </>
  );
}

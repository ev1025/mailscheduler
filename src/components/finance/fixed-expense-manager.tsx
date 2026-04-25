"use client";

import { useState } from "react";
import FormPage from "@/components/ui/form-page";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
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
              {fixedExpenses.map((fx) => (
                <div
                  key={fx.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenEdit(fx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleOpenEdit(fx);
                  }}
                  className="group flex items-center justify-between rounded-lg border p-2.5 cursor-pointer transition-colors hover:bg-accent/50 active:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    {/* 지출명(title) 이 제일 크게. 없으면 description → 카테고리명 폴백. */}
                    <p className="font-semibold text-sm truncate">
                      {fx.title || fx.description || fx.category?.name || "미분류"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span
                        className={`font-medium tabular-nums ${
                          fx.type === "income" ? "text-emerald-600" : "text-rose-500"
                        }`}
                      >
                        {fx.type === "income" ? "+" : "-"}
                        {formatWon(fx.amount)}
                      </span>
                      <span>매월 {fx.day_of_month}일</span>
                      {fx.category?.name && <span className="truncate">· {fx.category.name}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingFx(fx);
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-colors"
                    aria-label="고정비 삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
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
        title="고정비 삭제"
        description={
          deletingFx
            ? `"${deletingFx.title || deletingFx.description || "이 고정비"}" 항목을 삭제합니다. 이미 이 달에 반영된 거래는 유지되고, 다음 달부터 자동 추가되지 않습니다.`
            : ""
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

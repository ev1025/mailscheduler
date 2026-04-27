"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import FormPage from "@/components/ui/form-page";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import TagInput from "@/components/ui/tag-input";
import { FORM_LABEL, FORM_INPUT_PRIMARY } from "@/lib/form-classes";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import type { ExpenseCategory } from "@/types";
import type { FixedExpense } from "@/hooks/use-fixed-expenses";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 기존 항목 수정이면 값 주입, 없으면 신규. */
  fixed: FixedExpense | null;
  categories: ExpenseCategory[];
  onSave: (data: {
    title: string | null;
    amount: number;
    category_id: string;
    description: string | null;
    day_of_month: number;
    type: "income" | "expense";
    payment_method: string;
  }) => Promise<{ error: unknown }>;
  /** 카테고리 TagInput mutation */
  onAddCategory?: (
    name: string,
    type: "income" | "expense",
    color: string
  ) => Promise<{ error: unknown }>;
  onDeleteCategory?: (id: string) => Promise<{ error: unknown }>;
  onUpdateCategoryColor?: (id: string, color: string) => Promise<{ error: unknown }>;
}

export default function FixedExpenseForm({
  open,
  onOpenChange,
  fixed,
  categories,
  onSave,
  onAddCategory,
  onDeleteCategory,
  onUpdateCategoryColor,
}: Props) {
  const { methods: paymentMethods, addMethod, deleteMethod, updateMethodColor } =
    usePaymentMethods();

  const [type, setType] = useState<"income" | "expense">("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (fixed) {
      setType(fixed.type);
      setTitle(fixed.title || "");
      setAmount(String(fixed.amount));
      setCategoryId(fixed.category_id);
      setDescription(fixed.description || "");
      setDayOfMonth(String(fixed.day_of_month));
      setPaymentMethod(fixed.payment_method || "");
    } else {
      setType("expense");
      setTitle("");
      setAmount("");
      setCategoryId("");
      setDescription("");
      setDayOfMonth("1");
      setPaymentMethod("");
    }
  }, [open, fixed]);

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleSubmit = async () => {
    if (!amount || !categoryId) return;
    setSaving(true);
    const { error } = await onSave({
      title: title.trim() || null,
      amount: parseInt(amount, 10),
      category_id: categoryId,
      description: description.trim() || null,
      day_of_month: parseInt(dayOfMonth, 10) || 1,
      type,
      payment_method: paymentMethod || "계좌이체",
    });
    setSaving(false);
    if (error) {
      // 침묵 실패 방지 — DB 제약(예: payment_method CHECK) 위반 등을 사용자에게 표시.
      const msg =
        typeof error === "object" && error && "message" in error
          ? String((error as { message?: unknown }).message)
          : "저장 실패";
      toast.error(msg);
      return;
    }
    onOpenChange(false);
  };

  return (
    <FormPage
      open={open}
      onOpenChange={onOpenChange}
      title={fixed ? "고정비 수정" : "새 고정비"}
      submitDisabled={!amount || !categoryId}
      saving={saving}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-4">
        {/* 지출명 — 목록에서 제일 크게 보이는 제목 필드 (DB 컬럼: title). */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fx-title" className={FORM_LABEL}>
            지출명
          </Label>
          <Textarea
            id="fx-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 넷플릭스, 월세"
            rows={2}
            className="min-h-0"
          />
        </div>

        {/* 수입/지출 세그먼트 — 톤 다운: 활성 상태도 강한 빨강·녹색 대신 차분한 색상. */}
        <div className="flex gap-2">
          <button
            type="button"
            className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors border ${
              type === "expense"
                ? "border-rose-300/60 bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:border-rose-500/30"
                : "text-muted-foreground hover:bg-accent"
            }`}
            onClick={() => {
              setType("expense");
              setCategoryId("");
            }}
          >
            지출
          </button>
          <button
            type="button"
            className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors border ${
              type === "income"
                ? "border-emerald-300/60 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/30"
                : "text-muted-foreground hover:bg-accent"
            }`}
            onClick={() => {
              setType("income");
              setCategoryId("");
            }}
          >
            수입
          </button>
        </div>

        {/* 금액 + 결제일 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5 min-w-0">
            <Label className={FORM_LABEL}>
              금액<span className="text-rose-500 ml-0.5">*</span>
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50000"
              className={FORM_INPUT_PRIMARY}
            />
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <Label className={FORM_LABEL}>매월 결제일</Label>
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") { setDayOfMonth(""); return; }
                const n = parseInt(v, 10);
                if (isNaN(n)) return;
                // HTML max 는 검증만 하고 입력 자체를 막지 않으므로 onChange 에서 clamp.
                setDayOfMonth(String(Math.min(31, Math.max(1, n))));
              }}
              className={FORM_INPUT_PRIMARY}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2 leading-snug">
          29~31일은 해당 일자가 없는 달(2월 등)엔 월말에 자동 반영돼요.
        </p>

        {/* 카테고리 */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <Label className={FORM_LABEL}>
            카테고리<span className="text-rose-500 ml-0.5">*</span>
          </Label>
          <TagInput
            selectedTags={
              categoryId
                ? [filteredCategories.find((c) => c.id === categoryId)?.name || ""]
                : []
            }
            allTags={filteredCategories.map((c) => ({
              id: c.id,
              name: c.name,
              color: c.color,
            }))}
            onChange={(tags) => {
              const picked = tags[tags.length - 1];
              const match = filteredCategories.find((c) => c.name === picked);
              setCategoryId(match?.id || "");
            }}
            onAddTag={
              onAddCategory
                ? async (name, color) => onAddCategory(name, type, color)
                : undefined
            }
            onDeleteTag={onDeleteCategory}
            onUpdateTagColor={onUpdateCategoryColor}
            placeholder="검색·추가"
          />
        </div>

        {/* 결제수단 */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <Label className={FORM_LABEL}>결제수단</Label>
          <TagInput
            selectedTags={paymentMethod ? [paymentMethod] : []}
            allTags={paymentMethods}
            onChange={(tags) => setPaymentMethod(tags[tags.length - 1] || "")}
            onAddTag={addMethod}
            onDeleteTag={deleteMethod}
            onUpdateTagColor={updateMethodColor}
            placeholder="검색·추가"
          />
        </div>

        {/* 메모 */}
        <div className="flex flex-col gap-1.5">
          <Label className={FORM_LABEL}>메모</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="세부 내용 (선택)"
            className={FORM_INPUT_PRIMARY}
          />
        </div>
      </div>
    </FormPage>
  );
}

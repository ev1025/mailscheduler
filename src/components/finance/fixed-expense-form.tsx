"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import FormPage from "@/components/ui/form-page";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import TagInput from "@/components/ui/tag-input";
import NumberWheel from "@/components/ui/number-wheel";
import { FormField } from "@/components/ui/form-field";
import { FORM_INPUT_PRIMARY } from "@/lib/form-classes";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import type { ExpenseCategory } from "@/types";
import type { FixedExpense } from "@/hooks/use-fixed-expenses";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 기존 항목 수정이면 값 주입, 없으면 신규. */
  fixed: FixedExpense | null;
  categories: ExpenseCategory[];
  /** 신규 추가 시: 두 번째 인자로 반복 개월 수 (1=이번달만, -1=계속/120). 수정 시엔 무시. */
  onSave: (
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
  ) => Promise<{ error: unknown }>;
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
  // 반복 개월 수 — 신규 등록 시에만 사용. 1=이번달만, -1=계속(120개월).
  const [repeatMonths, setRepeatMonths] = useState<number>(1);

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
      setRepeatMonths(1);
    }
  }, [open, fixed]);

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleSubmit = async () => {
    if (!amount || !categoryId) return;
    setSaving(true);
    const { error } = await onSave(
      {
        title: title.trim() || null,
        amount: parseInt(amount, 10),
        category_id: categoryId,
        description: description.trim() || null,
        day_of_month: parseInt(dayOfMonth, 10) || 1,
        type,
        payment_method: paymentMethod || "계좌이체",
      },
      // 신규일 때만 의미. 수정 시엔 manager 가 무시.
      fixed ? undefined : repeatMonths,
    );
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
        <FormField label="지출명" htmlFor="fx-title">
          <Textarea
            id="fx-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 넷플릭스, 월세"
            rows={2}
            className="min-h-0"
          />
        </FormField>

        {/* 수입/지출 세그먼트 — finance 시멘틱 토큰 사용. opacity 단계로 라이트/다크 자동 대응. */}
        <div className="flex gap-2">
          <button
            type="button"
            className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors border ${
              type === "expense"
                ? "border-finance-loss/30 bg-finance-loss/10 text-finance-loss"
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
                ? "border-finance-gain/30 bg-finance-gain/10 text-finance-gain"
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
          <FormField label="금액" required>
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50000"
              className={FORM_INPUT_PRIMARY}
            />
          </FormField>
          <FormField label="매월 결제일">
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
          </FormField>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2 leading-snug">
          29~31일은 해당 일자가 없는 달(2월 등)엔 월말에 자동 반영돼요.
        </p>

        {/* 반복 개월 수 — 신규 등록 시만. 캘린더 일정의 "반복 횟수" 와 동일.
            1 = 이번달만, "계속"(-1) = 120개월(10년) 일괄 생성. */}
        {!fixed && (
          <FormField label="반복">
            <div className="flex items-center gap-2">
              <NumberWheel
                value={repeatMonths}
                onChange={setRepeatMonths}
                min={1}
                max={120}
                allowInfinity
              />
              <span className="text-xs text-muted-foreground">개월 (이번달부터)</span>
            </div>
          </FormField>
        )}

        {/* 카테고리 */}
        <FormField label="카테고리" required>
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
        </FormField>

        {/* 결제수단 */}
        <FormField label="결제수단">
          <TagInput
            selectedTags={paymentMethod ? [paymentMethod] : []}
            allTags={paymentMethods}
            onChange={(tags) => setPaymentMethod(tags[tags.length - 1] || "")}
            onAddTag={addMethod}
            onDeleteTag={deleteMethod}
            onUpdateTagColor={updateMethodColor}
            placeholder="검색·추가"
          />
        </FormField>

        {/* 메모 */}
        <FormField label="메모">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="세부 내용 (선택)"
            className={FORM_INPUT_PRIMARY}
          />
        </FormField>
      </div>
    </FormPage>
  );
}

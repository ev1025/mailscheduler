"use client";

import { useState, useEffect } from "react";
import FormPage from "@/components/ui/form-page";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import TagInput from "@/components/ui/tag-input";
import DatePicker from "@/components/ui/date-picker";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { FORM_LABEL, FORM_INPUT_COMPACT } from "@/lib/form-classes";
import type { Expense, ExpenseCategory } from "@/types";

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
  transaction?: Expense | null;
  onAddCategory?: (
    name: string,
    type: "income" | "expense",
    color: string
  ) => Promise<{ error: unknown }>;
  onDeleteCategory?: (id: string) => Promise<{ error: unknown }>;
  onUpdateCategoryColor?: (id: string, color: string) => Promise<{ error: unknown }>;
  onSave: (data: {
    title: string | null;
    amount: number;
    category_id: string;
    description: string | null;
    date: string;
    type: "income" | "expense";
    payment_method: string;
  }) => Promise<{ error: unknown }>;
}

export default function TransactionForm({
  open,
  onOpenChange,
  categories,
  transaction,
  onAddCategory,
  onDeleteCategory,
  onUpdateCategoryColor,
  onSave,
}: TransactionFormProps) {
  const { methods: paymentMethods, addMethod, deleteMethod, updateMethodColor } = usePaymentMethods();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("카드");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setTitle(transaction.title || "");
      setAmount(String(transaction.amount));
      setCategoryId(transaction.category_id);
      setDescription(transaction.description || "");
      setDate(transaction.date);
      setPaymentMethod(transaction.payment_method);
    } else {
      setType("expense");
      setTitle("");
      setAmount("");
      setCategoryId("");
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("카드");
    }
  }, [transaction, open]);

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleSubmit = async () => {
    if (!amount || !categoryId) return;
    setSaving(true);
    const { error } = await onSave({
      title: title.trim() || null,
      amount: parseInt(amount, 10),
      category_id: categoryId,
      description: description.trim() || null,
      date,
      type,
      payment_method: paymentMethod,
    });
    setSaving(false);
    if (!error) onOpenChange(false);
  };

  return (
    <FormPage
      open={open}
      onOpenChange={onOpenChange}
      title={transaction ? "내역 수정" : "내역 추가"}
      submitDisabled={!amount || !categoryId}
      saving={saving}
      onSubmit={handleSubmit}
    >
        <div className="flex flex-col gap-4">
          {/* 지출명 — 목록에서 제일 크게 보이는 제목 필드 (DB 컬럼: title). */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title" className={FORM_LABEL}>
              지출명
            </Label>
            <Textarea
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 기후동행카드, 점심"
              rows={2}
              className="min-h-0 text-sm"
            />
          </div>

          {/* 1행: 금액 | 날짜 — 별도 지출/수입 토글 제거. 금액 좌측 부호 버튼 (− 지출 / + 수입)
              으로 통합. 부호 변경 시 type 자동 전환 + categoryId 리셋. */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5 min-w-0">
              <Label htmlFor="amount" className={FORM_LABEL}>
                금액 (원)
              </Label>
              <div className="flex gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setType((t) => (t === "expense" ? "income" : "expense"));
                    setCategoryId("");
                  }}
                  className={`shrink-0 h-9 w-10 rounded-md border text-lg font-semibold leading-none transition-colors ${
                    type === "expense"
                      ? "border-rose-300/60 bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:border-rose-500/30"
                      : "border-emerald-300/60 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/30"
                  }`}
                  aria-label={type === "expense" ? "지출 (눌러서 수입으로 전환)" : "수입 (눌러서 지출로 전환)"}
                  title={type === "expense" ? "지출" : "수입"}
                >
                  {type === "expense" ? "−" : "+"}
                </button>
                <Input
                  id="amount"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10000"
                  className={`${FORM_INPUT_COMPACT} flex-1 min-w-0`}
                />
              </div>
              {/* 빠른 입력 프리셋 — 현재값에 더하기. 모바일 keypad 왕복 줄임. */}
              <div className="flex flex-wrap gap-1">
                {[1000, 5000, 10000, 50000, 100000].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => {
                      const cur = parseInt(amount || "0", 10) || 0;
                      setAmount(String(cur + delta));
                    }}
                    className="px-2 py-0.5 rounded border text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    +{delta >= 10000 ? `${delta / 10000}만` : `${delta / 1000}천`}
                  </button>
                ))}
                {amount && (
                  <button
                    type="button"
                    onClick={() => setAmount("")}
                    className="px-2 py-0.5 rounded border text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <Label className={FORM_LABEL}>날짜</Label>
              <DatePicker
                value={date}
                onChange={setDate}
                className={`${FORM_INPUT_COMPACT} w-full min-w-0`}
              />
            </div>
          </div>

          {/* 2행: 카테고리 | 결제수단 (태그 형식) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5 min-w-0">
              <Label className={FORM_LABEL}>카테고리</Label>
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
                placeholder="검색/추가"
              />
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <Label className={FORM_LABEL}>결제수단</Label>
              <TagInput
                selectedTags={paymentMethod ? [paymentMethod] : []}
                allTags={paymentMethods}
                onChange={(tags) => setPaymentMethod(tags[tags.length - 1] || "")}
                onAddTag={addMethod}
                onDeleteTag={deleteMethod}
                onUpdateTagColor={updateMethodColor}
                placeholder="검색/추가"
              />
            </div>
          </div>

          {/* 메모 — 상세 내용. 목록에는 안 보이고 편집 폼에서만. */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="desc" className={FORM_LABEL}>
              메모
            </Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="세부 내용 (선택)"
              className={FORM_INPUT_COMPACT}
            />
          </div>

        </div>
    </FormPage>
  );
}

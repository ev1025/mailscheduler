"use client";

import { useState, useEffect } from "react";
import FormPage from "@/components/ui/form-page";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TagInput from "@/components/ui/tag-input";
import DatePicker from "@/components/ui/date-picker";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { FORM_LABEL, FORM_INPUT_PRIMARY } from "@/lib/form-classes";

// native <select> 를 Input 과 동일한 룩으로 — 가계부·고정비 폼에서 같이 쓰는 토큰.
const FORM_SELECT_CLASS =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
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
  onSave: (
    data: {
      title: string | null;
      amount: number;
      category_id: string;
      description: string | null;
      date: string;
      type: "income" | "expense";
      payment_method: string;
    },
    /** 신규 등록 시에만 의미 있음. 2 이상이면 같은 일자에 N개월 할부로 일괄 등록. */
    installmentMonths?: number
  ) => Promise<{ error: unknown }>;
}

const PRESET_AMOUNTS: { value: number; label: string }[] = [
  { value: 5000, label: "+5천" },
  { value: 10000, label: "+1만" },
  { value: 30000, label: "+3만" },
  { value: 50000, label: "+5만" },
  { value: 100000, label: "+10만" },
];

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
  const [paymentMethod, setPaymentMethod] = useState("");
  /** 할부 개월 수 — 1 = 일시불 (기본), 2~24 가능. 수정 모드에선 비활성. */
  const [installmentMonths, setInstallmentMonths] = useState(1);
  const [saving, setSaving] = useState(false);

  const isEdit = !!transaction;

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setTitle(transaction.title || "");
      setAmount(String(transaction.amount));
      setCategoryId(transaction.category_id);
      setDescription(transaction.description || "");
      setDate(transaction.date);
      setPaymentMethod(transaction.payment_method);
      setInstallmentMonths(1);
    } else {
      setType("expense");
      setTitle("");
      setAmount("");
      setCategoryId("");
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("");
      setInstallmentMonths(1);
    }
  }, [transaction, open]);

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
        date,
        type,
        payment_method: paymentMethod,
      },
      isEdit ? undefined : installmentMonths
    );
    setSaving(false);
    if (!error) onOpenChange(false);
  };

  return (
    <FormPage
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "내역 수정" : "내역 추가"}
      submitDisabled={!amount || !categoryId}
      saving={saving}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-4">
        {/* 1. 지출명 */}
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

        {/* 2. 지출/수입 Tabs */}
        <Tabs
          value={type}
          onValueChange={(v) => {
            setType(v as "income" | "expense");
            setCategoryId("");
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="expense" className="flex-1">
              지출
            </TabsTrigger>
            <TabsTrigger value="income" className="flex-1">
              수입
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 3. 금액 */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <Label htmlFor="amount" className={FORM_LABEL}>
            금액 (원)
          </Label>
          <Input
            id="amount"
            type="number"
            inputMode="numeric"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10000"
            className={FORM_INPUT_PRIMARY}
          />
        </div>

        {/* 3. 프리셋 — 5천/1만/3만/5만/10만 + 클리어 */}
        <div className="flex flex-wrap gap-1 -mt-2">
          {PRESET_AMOUNTS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                const cur = parseInt(amount || "0", 10) || 0;
                setAmount(String(cur + p.value));
              }}
              className="px-2.5 py-1 rounded-md border text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {p.label}
            </button>
          ))}
          {amount && (
            <button
              type="button"
              onClick={() => setAmount("")}
              className="px-2.5 py-1 rounded-md border text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              aria-label="금액 비우기"
            >
              ×
            </button>
          )}
        </div>

        {/* 4. 날짜 | 할부 — 수정 모드에선 할부 비활성(이미 묶음 만들어진 상태) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5 min-w-0">
            <Label className={FORM_LABEL}>날짜</Label>
            <DatePicker
              value={date}
              onChange={setDate}
              className={`${FORM_INPUT_PRIMARY} w-full min-w-0`}
            />
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <Label htmlFor="installment" className={FORM_LABEL}>
              할부
            </Label>
            <select
              id="installment"
              value={installmentMonths}
              onChange={(e) => setInstallmentMonths(parseInt(e.target.value, 10))}
              disabled={isEdit}
              className={`${FORM_SELECT_CLASS} disabled:opacity-50`}
              title={isEdit ? "수정 모드에선 할부 변경 불가" : "다음 달부터 같은 일자에 자동 등록"}
            >
              <option value={1}>일시불</option>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 24].map((n) => (
                <option key={n} value={n}>
                  {n}개월
                </option>
              ))}
            </select>
          </div>
        </div>
        {!isEdit && installmentMonths > 1 && amount && (
          <p className="text-[11px] text-muted-foreground -mt-2 leading-snug">
            매월 같은 일자에 약 {Math.floor(parseInt(amount, 10) / installmentMonths).toLocaleString()}원씩 {installmentMonths}건 자동 등록됩니다. 한 건 삭제 시 묶음 전체가 함께 삭제돼요.
          </p>
        )}

        {/* 5. 카테고리 | 결제수단 */}
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

        {/* 6. 메모 */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desc" className={FORM_LABEL}>
            메모
          </Label>
          <Input
            id="desc"
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

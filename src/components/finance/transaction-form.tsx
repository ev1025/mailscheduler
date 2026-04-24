"use client";

import { useState, useEffect } from "react";
import FormPage from "@/components/ui/form-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("카드");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(String(transaction.amount));
      setCategoryId(transaction.category_id);
      setDescription(transaction.description || "");
      setDate(transaction.date);
      setPaymentMethod(transaction.payment_method);
    } else {
      setType("expense");
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

          {/* 1행: 금액 | 날짜 */}
          <div className="grid grid-cols-2 gap-2">
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
                placeholder="금액 * (예: 10000)"
                className={FORM_INPUT_COMPACT}
              />
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

          {/* 3행: 메모 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="desc" className={FORM_LABEL}>
              메모
            </Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="어디서 뭘 샀는지 등"
              className={FORM_INPUT_COMPACT}
            />
          </div>

        </div>
    </FormPage>
  );
}

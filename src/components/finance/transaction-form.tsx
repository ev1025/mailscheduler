"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Expense, ExpenseCategory } from "@/types";

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
  transaction?: Expense | null;
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
  onSave,
}: TransactionFormProps) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "내역 수정" : "내역 추가"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            <div className="flex flex-col gap-1 min-w-0">
              <Label
                htmlFor="amount"
                className="text-[11px] text-muted-foreground"
              >
                금액 (원) *
              </Label>
              <Input
                id="amount"
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                autoFocus
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <Label
                htmlFor="date"
                className="text-[11px] text-muted-foreground"
              >
                날짜
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 w-full"
              />
            </div>
          </div>

          {/* 2행: 카테고리 | 결제수단 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 min-w-0">
              <Label className="text-[11px] text-muted-foreground">
                카테고리 *
              </Label>
              <Select
                value={categoryId}
                onValueChange={(v) => setCategoryId(v ?? "")}
              >
                <SelectTrigger className="h-9 w-full">
                  {categoryId ? (
                    filteredCategories.find((c) => c.id === categoryId)
                      ?.name || "선택"
                  ) : (
                    <span className="text-muted-foreground">선택</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <Label className="text-[11px] text-muted-foreground">
                결제수단
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v ?? "카드")}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="카드">카드</SelectItem>
                  <SelectItem value="현금">현금</SelectItem>
                  <SelectItem value="계좌이체">계좌이체</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 3행: 메모 */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="desc" className="text-[11px] text-muted-foreground">
              메모
            </Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="어디서 뭘 샀는지 등"
              className="h-9"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!amount || !categoryId || saving}
            >
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
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
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import type { ExpenseCategory } from "@/types";
import type { FixedExpense } from "@/hooks/use-fixed-expenses";

interface FixedExpenseManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixedExpenses: FixedExpense[];
  categories: ExpenseCategory[];
  onAdd: (item: Omit<FixedExpense, "id" | "created_at" | "category" | "is_active">) => Promise<{ error: unknown }>;
  onDelete: (id: string) => Promise<{ error: unknown }>;
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
  onDelete,
}: FixedExpenseManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [type, setType] = useState<"income" | "expense">("expense");

  const expenseCategories = categories.filter((c) => c.type === type);

  const handleAdd = async () => {
    if (!amount || !categoryId) return;
    await onAdd({
      amount: parseInt(amount),
      category_id: categoryId,
      description: description.trim() || null,
      day_of_month: parseInt(dayOfMonth) || 1,
      type,
      payment_method: "계좌이체",
    });
    setAmount("");
    setCategoryId("");
    setDescription("");
    setDayOfMonth("1");
    setShowForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>고정비 관리</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            매월 자동으로 추가되는 고정 수입/지출 항목입니다.
          </p>

          {/* 기존 고정비 목록 */}
          {fixedExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 고정비가 없습니다</p>
          ) : (
            <div className="flex flex-col gap-1">
              {fixedExpenses.map((fx) => (
                <div key={fx.id} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={fx.type === "income" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {fx.type === "income" ? "+" : "-"}{formatWon(fx.amount)}
                      </span>
                      <span className="text-muted-foreground text-xs">매월 {fx.day_of_month}일</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {fx.category?.name} {fx.description && `· ${fx.description}`}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => onDelete(fx.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 추가 폼 */}
          {showForm ? (
            <div className="flex flex-col gap-2.5 border rounded-lg p-3">
              <div className="flex gap-2">
                <Button size="sm" variant={type === "expense" ? "default" : "outline"} className="flex-1 h-8" onClick={() => { setType("expense"); setCategoryId(""); }}>지출</Button>
                <Button size="sm" variant={type === "income" ? "default" : "outline"} className="flex-1 h-8" onClick={() => { setType("income"); setCategoryId(""); }}>수입</Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">금액 *</Label>
                  <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" className="h-8" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">매월 결제일</Label>
                  <Input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className="h-8" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">카테고리 *</Label>
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                  <SelectTrigger className="h-8">
                    {categoryId ? expenseCategories.find((c) => c.id === categoryId)?.name || "선택" : <span className="text-muted-foreground">선택</span>}
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">설명</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="넷플릭스, 월세 등" className="h-8" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>취소</Button>
                <Button size="sm" className="flex-1" onClick={handleAdd} disabled={!amount || !categoryId}>추가</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="mr-1 h-4 w-4" />
              고정비 추가
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

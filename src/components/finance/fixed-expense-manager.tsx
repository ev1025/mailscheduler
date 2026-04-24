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
  onAdd: (
    item: Omit<FixedExpense, "id" | "created_at" | "category" | "is_active">
  ) => Promise<{ error: unknown }>;
  onUpdate?: (
    id: string,
    updates: Partial<Omit<FixedExpense, "id" | "created_at" | "category">>
  ) => Promise<{ error: unknown }>;
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
  onUpdate,
  onDelete,
}: FixedExpenseManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [type, setType] = useState<"income" | "expense">("expense");

  const filteredCategories = categories.filter((c) => c.type === type);

  const resetForm = () => {
    setAmount("");
    setCategoryId("");
    setDescription("");
    setDayOfMonth("1");
    setType("expense");
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (fx: FixedExpense) => {
    setEditingId(fx.id);
    setAmount(String(fx.amount));
    setCategoryId(fx.category_id);
    setDescription(fx.description || "");
    setDayOfMonth(String(fx.day_of_month));
    setType(fx.type);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!amount || !categoryId) return;
    const payload = {
      amount: parseInt(amount),
      category_id: categoryId,
      description: description.trim() || null,
      day_of_month: parseInt(dayOfMonth) || 1,
      type,
      payment_method: "계좌이체",
    };
    if (editingId && onUpdate) {
      await onUpdate(editingId, payload);
    } else {
      await onAdd(payload);
    }
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>고정비 관리</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            매월 자동으로 추가되는 고정 수입/지출 항목입니다. 항목을 클릭하면 수정할 수 있습니다.
          </p>

          {/* 기존 고정비 목록 */}
          {fixedExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              등록된 고정비가 없습니다
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {fixedExpenses.map((fx) => {
                const isEditing = editingId === fx.id;
                return (
                  <div
                    key={fx.id}
                    onClick={() => !showForm || isEditing ? startEdit(fx) : undefined}
                    className={`group flex items-center justify-between rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      isEditing ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className={
                            fx.type === "income"
                              ? "text-green-600 font-medium"
                              : "text-red-600 font-medium"
                          }
                        >
                          {fx.type === "income" ? "+" : "-"}
                          {formatWon(fx.amount)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          매월 {fx.day_of_month}일
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {fx.category?.name}
                        {fx.description && ` · ${fx.description}`}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editingId === fx.id) resetForm();
                        onDelete(fx.id);
                      }}
                      aria-label="고정비 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 추가/수정 폼 */}
          {showForm ? (
            <div className="flex flex-col gap-2.5 border rounded-lg p-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={type === "expense" ? "default" : "outline"}
                  className="flex-1 h-8"
                  onClick={() => {
                    setType("expense");
                    setCategoryId("");
                  }}
                >
                  지출
                </Button>
                <Button
                  size="sm"
                  variant={type === "income" ? "default" : "outline"}
                  className="flex-1 h-8"
                  onClick={() => {
                    setType("income");
                    setCategoryId("");
                  }}
                >
                  수입
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">금액</Label>
                  <Input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="50000"
                    className="h-8"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">매월 결제일</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">카테고리</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => setCategoryId(v ?? "")}
                >
                  <SelectTrigger className="h-8">
                    {categoryId ? (
                      filteredCategories.find((c) => c.id === categoryId)?.name || "선택"
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
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">설명</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="넷플릭스, 월세 등"
                  className="h-8"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={resetForm}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleSave}
                  disabled={!amount || !categoryId}
                >
                  {editingId ? "수정" : "추가"}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="mr-1 h-4 w-4" />
              고정비 추가
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

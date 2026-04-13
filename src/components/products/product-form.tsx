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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Plus, Trash2, HelpCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useFixedExpenses } from "@/hooks/use-fixed-expenses";
import { useTransactions } from "@/hooks/use-transactions";
import { toast } from "sonner";
import type { Product, ProductCategory } from "@/types";

const CATEGORIES: ProductCategory[] = [
  "영양제",
  "화장품",
  "단백질",
  "음식",
  "생필품",
  "구독",
  "기타",
];

interface PriceEntry {
  id?: string;
  price: string;
  site_url: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (
    data: Omit<Product, "id" | "created_at" | "updated_at">
  ) => Promise<{ error: unknown; data?: Product | null }>;
}

export default function ProductForm({
  open,
  onOpenChange,
  product,
  onSave,
}: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("영양제");
  const [subCategory, setSubCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [prices, setPrices] = useState<PriceEntry[]>([
    { price: "", site_url: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const { upsertFixedFromProduct, deleteFixedByProduct } = useFixedExpenses();
  const now = new Date();
  const { categories: expCategories } = useTransactions(
    now.getFullYear(),
    now.getMonth() + 1
  );

  // 기존 제품 수정 시 DB에서 가격들 로드
  useEffect(() => {
    if (!open) return;
    if (product) {
      setName(product.name);
      setCategory(product.category);
      setSubCategory(product.sub_category || "");
      setBrand(product.brand || "");
      setNotes(product.notes || "");
      setIsActive(product.is_active);
      // 가격 이력 로드
      supabase
        .from("product_purchases")
        .select("id, total_price, link")
        .eq("product_id", product.id)
        .order("total_price")
        .then(({ data }) => {
          if (data && data.length > 0) {
            setPrices(
              data.map((p) => ({
                id: p.id,
                price: String(p.total_price),
                site_url: p.link || "",
              }))
            );
          } else {
            setPrices([{ price: "", site_url: "" }]);
          }
        });
    } else {
      setName("");
      setCategory("영양제");
      setSubCategory("");
      setBrand("");
      setNotes("");
      setIsActive(false);
      setPrices([{ price: "", site_url: "" }]);
    }
  }, [product, open]);

  const addPriceRow = () => {
    setPrices((prev) => [...prev, { price: "", site_url: "" }]);
  };

  const updatePriceRow = (i: number, field: keyof PriceEntry, value: string) => {
    setPrices((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p))
    );
  };

  const removePriceRow = (i: number) => {
    setPrices((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    // 1. 제품 저장
    const validPrices = prices.filter((p) => p.price && parseInt(p.price) > 0);
    const minPrice = validPrices.length
      ? Math.min(...validPrices.map((p) => parseInt(p.price)))
      : null;

    const { error, data } = await onSave({
      name: name.trim(),
      category,
      sub_category: subCategory.trim() || null,
      brand: brand.trim() || null,
      notes: notes.trim() || null,
      link: validPrices[0]?.site_url || null,
      is_active: isActive,
      monthly_cost: minPrice,
      monthly_consumption: product?.monthly_consumption ?? 1,
      default_payment_day: product?.default_payment_day ?? 11,
    });
    if (error || !data) {
      setSaving(false);
      toast.error("저장 실패");
      return;
    }

    const productId = data.id;

    // 2. 가격 목록 업데이트 — 기존 것 삭제 후 새로 삽입
    await supabase
      .from("product_purchases")
      .delete()
      .eq("product_id", productId);

    if (validPrices.length > 0) {
      await supabase.from("product_purchases").insert(
        validPrices.map((p) => ({
          product_id: productId,
          total_price: parseInt(p.price),
          points: 0,
          quantity: 1,
          quantity_unit: "개",
          purchased_at: new Date().toISOString().split("T")[0],
          store: null,
          link: p.site_url.trim() || null,
          notes: null,
        }))
      );
    }

    // 3. 고정비 등록/해제
    if (isActive && minPrice) {
      const expenseCat =
        expCategories.find(
          (c) =>
            c.type === "expense" &&
            (c.name === "기타지출" || c.name.includes("생활"))
        ) || expCategories.find((c) => c.type === "expense");
      if (expenseCat) {
        await upsertFixedFromProduct({
          productId,
          productName: name.trim(),
          monthlyCost: minPrice,
          paymentDay: 11,
          categoryId: expenseCat.id,
        });
      }
    } else {
      await deleteFixedByProduct(productId);
    }

    setSaving(false);
    toast.success(product ? "수정되었습니다" : "추가되었습니다");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "제품 수정" : "제품 추가"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="제품명 (예: 오메가3)"
            autoFocus
            className="h-9"
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">분류</Label>
              <Select
                value={category}
                onValueChange={(v) => v && setCategory(v as ProductCategory)}
              >
                <SelectTrigger className="h-9 w-full">{category}</SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">
                세부분류
              </Label>
              <Input
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                placeholder="예: 종합비타민"
                className="h-9"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">브랜드</Label>
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="브랜드명"
              className="h-9"
            />
          </div>

          {/* 가격 목록 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">가격 / 사이트</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addPriceRow}
                className="h-7 text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                가격 추가
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-[1fr_2fr_auto] gap-1.5 text-[10px] text-muted-foreground px-1">
                <span>가격</span>
                <span>사이트</span>
                <span className="w-6"></span>
              </div>
              {prices.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_2fr_auto] gap-1.5 items-center"
                >
                  <Input
                    type="number"
                    value={p.price}
                    onChange={(e) => updatePriceRow(i, "price", e.target.value)}
                    placeholder="35000"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={p.site_url}
                    onChange={(e) =>
                      updatePriceRow(i, "site_url", e.target.value)
                    }
                    placeholder="https://naver.com/..."
                    className="h-8 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removePriceRow(i)}
                    disabled={prices.length === 1}
                    className="w-6 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 고정비 등록 체크박스 */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm">가계부 고정비에 등록</span>
            <span
              className="relative text-muted-foreground"
              title="고정비 등록 시 매월 11일 결제로 등록됩니다"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] text-background opacity-0 group-hover:opacity-100 transition-opacity z-10">
                고정비 등록 시 매월 11일 결제로 등록됩니다
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">
              성분/메모
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="성분, 특이사항 등"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

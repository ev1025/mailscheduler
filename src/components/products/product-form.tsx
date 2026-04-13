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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (
    data: Omit<Product, "id" | "created_at" | "updated_at">
  ) => Promise<{ error: unknown }>;
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
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setName(product.name);
      setCategory(product.category);
      setSubCategory(product.sub_category || "");
      setBrand(product.brand || "");
      setLink(product.link || "");
      setNotes(product.notes || "");
    } else {
      setName("");
      setCategory("영양제");
      setSubCategory("");
      setBrand("");
      setLink("");
      setNotes("");
    }
  }, [product, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await onSave({
      name: name.trim(),
      category,
      sub_category: subCategory.trim() || null,
      brand: brand.trim() || null,
      notes: notes.trim() || null,
      link: link.trim() || null,
      is_active: product?.is_active ?? false,
      monthly_cost: product?.monthly_cost ?? null,
      monthly_consumption: product?.monthly_consumption ?? 1,
      default_payment_day: product?.default_payment_day ?? 11,
    });
    setSaving(false);
    if (!error) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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

          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">
              구매 링크
            </Label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">
              성분/메모
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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

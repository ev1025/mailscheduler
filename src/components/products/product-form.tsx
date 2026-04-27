"use client";

import { useState, useEffect, useRef } from "react";
import FormPage from "@/components/ui/form-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, HelpCircle, Crown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUserId } from "@/lib/current-user";
import { useFixedExpenses } from "@/hooks/use-fixed-expenses";
import { useTransactions } from "@/hooks/use-transactions";
import { useProductCategories } from "@/hooks/use-product-categories";
import { useProductSubTags } from "@/hooks/use-product-subtags";
import TagInput from "@/components/ui/tag-input";
import { toast } from "sonner";
import type { Product, ProductCategory } from "@/types";
import {
  FORM_LABEL,
  FORM_HINT,
  FORM_INPUT_PRIMARY,
  FORM_INPUT_COMPACT,
  FORM_BUTTON_INLINE,
} from "@/lib/form-classes";

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
  const {
    tags: categoryTags,
    addCategory: addMidCategory,
    deleteCategory: deleteMidCategory,
    updateCategoryColor: updateMidCategoryColor,
  } = useProductCategories();
  const [subCategory, setSubCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [priceDraft, setPriceDraft] = useState("");
  const [siteDraft, setSiteDraft] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [fixedHelpOpen, setFixedHelpOpen] = useState(false);
  const fixedHelpRef = useRef<HTMLDivElement>(null);
  const userId = useCurrentUserId();

  // 고정비 도움말 외부 클릭 시 닫기
  useEffect(() => {
    if (!fixedHelpOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (fixedHelpRef.current && !fixedHelpRef.current.contains(e.target as Node)) {
        setFixedHelpOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [fixedHelpOpen]);

  const { tags: subTags, addTag, deleteTag, updateTagColor } = useProductSubTags(category);
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
            setPrices([]);
          }
        });
    } else {
      setName("");
      setCategory("영양제");
      setSubCategory("");
      setBrand("");
      setNotes("");
      setIsActive(false);
      setPrices([]);
    }
    setPriceDraft("");
    setSiteDraft("");
    setEditingIdx(null);
  }, [product, open]);

  const resetDraft = () => {
    setPriceDraft("");
    setSiteDraft("");
    setEditingIdx(null);
  };

  const commitPrice = () => {
    const priceNum = parseInt(priceDraft);
    if (!priceDraft || !(priceNum > 0)) return;
    const entry: PriceEntry = { price: String(priceNum), site_url: siteDraft.trim() };
    if (editingIdx !== null) {
      setPrices((prev) =>
        prev.map((p, idx) => (idx === editingIdx ? { ...p, ...entry } : p))
      );
    } else {
      setPrices((prev) => [...prev, entry]);
    }
    resetDraft();
  };

  const startEditPrice = (i: number) => {
    const p = prices[i];
    setPriceDraft(p.price);
    setSiteDraft(p.site_url);
    setEditingIdx(i);
  };

  const removePriceRow = (i: number) => {
    setPrices((prev) => prev.filter((_, idx) => idx !== i));
    if (editingIdx === i) resetDraft();
  };

  const handleSubmit = async () => {
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

    if (validPrices.length > 0 && userId) {
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
          user_id: userId,
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
    onOpenChange(false);
  };

  return (
    <>
    <FormPage
      open={open}
      onOpenChange={onOpenChange}
      title={product ? "제품 수정" : "제품 추가"}
      submitDisabled={!name.trim()}
      saving={saving}
      onSubmit={handleSubmit}
    >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-name" className={FORM_LABEL}>제품명</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="제품명 * (예: 오메가3)"
              className={FORM_INPUT_PRIMARY}
            />
          </div>

          {/* 분류 · 세부분류 — 항상 같은 행 (2열) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5 min-w-0">
              <Label className={FORM_LABEL}>분류</Label>
              <TagInput
                selectedTags={category ? [category] : []}
                allTags={categoryTags}
                onChange={(tags) => setCategory((tags[tags.length - 1] || "") as ProductCategory)}
                onAddTag={addMidCategory}
                onDeleteTag={deleteMidCategory}
                onUpdateTagColor={updateMidCategoryColor}
                placeholder="검색·추가"
              />
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <Label className={FORM_LABEL}>세부분류</Label>
              <TagInput
                selectedTags={subCategory ? [subCategory] : []}
                allTags={subTags}
                onChange={(tags) => setSubCategory(tags[tags.length - 1] || "")}
                onAddTag={addTag}
                onDeleteTag={deleteTag}
                onUpdateTagColor={updateTagColor}
                placeholder="검색·추가"
              />
            </div>
          </div>

          {/* 브랜드 — 별도 행 */}
          <div className="flex flex-col gap-1.5">
            <Label className={FORM_LABEL}>브랜드</Label>
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="브랜드명"
              className={FORM_INPUT_COMPACT}
            />
          </div>

          {/* 가격 입력 + 추가된 목록 */}
          <div className="flex flex-col gap-2">
            <Label className={FORM_LABEL}>가격 / 사이트</Label>
            <div className="flex items-center gap-1.5 min-w-0">
              <Input
                type="number"
                value={priceDraft}
                onChange={(e) => setPriceDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitPrice();
                  }
                }}
                placeholder="35000"
                className={`${FORM_INPUT_COMPACT} w-24 shrink-0`}
              />
              <Input
                value={siteDraft}
                onChange={(e) => setSiteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitPrice();
                  }
                }}
                placeholder="https://..."
                className={`${FORM_INPUT_COMPACT} flex-1 min-w-0`}
              />
              <Button
                type="button"
                variant={editingIdx !== null ? "default" : "outline"}
                onClick={commitPrice}
                disabled={!priceDraft || !(parseInt(priceDraft) > 0)}
                className={`${FORM_BUTTON_INLINE} shrink-0`}
              >
                {editingIdx !== null ? "수정" : "추가"}
              </Button>
              {editingIdx !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetDraft}
                  className={`${FORM_BUTTON_INLINE} shrink-0`}
                >
                  취소
                </Button>
              )}
            </div>

            {prices.length > 0 && (() => {
              const sorted = [...prices]
                .map((p, originalIdx) => ({ p, originalIdx }))
                .sort((a, b) => parseInt(a.p.price) - parseInt(b.p.price));
              const minPrice = sorted[0]?.p.price;
              return (
                <ul className="rounded-lg border bg-muted/30 divide-y divide-border/60 overflow-hidden">
                  {sorted.map(({ p, originalIdx }) => {
                    const isMin = p.price === minPrice;
                    const isEditing = editingIdx === originalIdx;
                    return (
                      <li
                        key={originalIdx}
                        onClick={() => startEditPrice(originalIdx)}
                        className={`group flex items-center gap-3 px-3 py-2 text-xs cursor-pointer transition-colors ${
                          isEditing ? "bg-primary/10" : "hover:bg-accent/50"
                        }`}
                      >
                        <span className="w-4 text-center text-yellow-500 shrink-0">
                          {isMin ? (
                            <Crown className="h-3.5 w-3.5 inline" />
                          ) : null}
                        </span>
                        <span
                          className={`tabular-nums font-semibold tracking-tight shrink-0 w-24 ${
                            isMin ? "text-yellow-700 dark:text-yellow-500" : "text-foreground"
                          }`}
                        >
                          {parseInt(p.price).toLocaleString()}원
                        </span>
                        <span className="flex-1 min-w-0 text-muted-foreground truncate">
                          {p.site_url || "—"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePriceRow(originalIdx);
                          }}
                          className="text-muted-foreground hover:text-destructive transition-opacity shrink-0 md:opacity-0 md:group-hover:opacity-100"
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
          </div>

          {/* 고정비 등록 체크박스 */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className={FORM_HINT}>고정비에 추가</span>
            </label>
            {/* 도움말 — label 바깥에 별도 버튼. 클릭해도 체크박스가 토글되지 않음 */}
            <div className="relative" ref={fixedHelpRef}>
              <button
                type="button"
                onClick={() => setFixedHelpOpen((o) => !o)}
                aria-label="도움말"
                className="flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
              {fixedHelpOpen && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max rounded-md bg-foreground px-2 py-1.5 text-xs text-background shadow-lg z-20 text-center leading-tight">
                  고정비 등록시<br />
                  매월 11일 결제로<br />
                  등록됩니다.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className={FORM_LABEL}>메모</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="성분·특이사항 등"
            />
          </div>

        </div>
    </FormPage>
    </>
  );
}

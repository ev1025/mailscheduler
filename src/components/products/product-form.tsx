"use client";

import { useState, useEffect } from "react";
import FormPage from "@/components/ui/form-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import DatePicker from "@/components/ui/date-picker";
import { Trash2, Crown, Plus } from "lucide-react";
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
  FORM_HINT,
  FORM_INPUT_PRIMARY,
  FORM_INPUT_COMPACT,
  FORM_BUTTON_INLINE,
} from "@/lib/form-classes";

interface PriceEntry {
  id?: string;
  price: string;
  site_url: string;
  /** 구매일 — yyyy-MM-dd. 입력 없으면 오늘. */
  purchased_at: string;
}

const todayIsoDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (
    data: Omit<Product, "id" | "created_at" | "updated_at">
  ) => Promise<{ error: unknown; data?: Product | null }>;
  /** 편집 모드일 때 footer 좌측 "삭제" 버튼이 호출하는 콜백. 미설정 시 버튼 미노출. */
  onDelete?: (product: Product) => void;
}

export default function ProductForm({
  open,
  onOpenChange,
  product,
  onSave,
  onDelete,
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
  const [dateDraft, setDateDraft] = useState(todayIsoDate());
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // 고정비 옵션 (isActive=true 일 때 노출)
  const [paymentDay, setPaymentDay] = useState("11");
  const [monthlyCostInput, setMonthlyCostInput] = useState("");
  const [fixedCategoryId, setFixedCategoryId] = useState<string>("");
  const userId = useCurrentUserId();

  const { tags: subTags, addTag, deleteTag, updateTagColor } = useProductSubTags(category);
  const { upsertFixedFromProduct, deleteFixedByProduct } = useFixedExpenses();
  // 가계부 카테고리 셀렉트 값으로 사용. transactions 자체는 안 씀.
  const todayIso = todayIsoDate();
  const { categories: expCategories } = useTransactions(todayIso, todayIso);
  const expenseCategories = expCategories.filter((c) => c.type === "expense");

  // 기존 제품 수정 시 DB에서 가격들 + 기존 고정비 카테고리 로드
  useEffect(() => {
    if (!open) return;
    if (product) {
      setName(product.name);
      setCategory(product.category);
      setSubCategory(product.sub_category || "");
      setBrand(product.brand || "");
      setNotes(product.notes || "");
      setIsActive(product.is_active);
      setPaymentDay(String(product.default_payment_day ?? 11));
      setMonthlyCostInput(product.monthly_cost ? String(product.monthly_cost) : "");
      // 가격 이력 (구매일 포함) 로드
      supabase
        .from("product_purchases")
        .select("id, total_price, link, purchased_at")
        .eq("product_id", product.id)
        .order("total_price")
        .then(({ data }) => {
          if (data && data.length > 0) {
            setPrices(
              data.map((p) => ({
                id: p.id,
                price: String(p.total_price),
                site_url: p.link || "",
                purchased_at: p.purchased_at || todayIsoDate(),
              }))
            );
          } else {
            setPrices([]);
          }
        });
      // 기존 고정비 행이 있으면 저장된 가계부 카테고리 ID 로드
      supabase
        .from("fixed_expenses")
        .select("category_id")
        .eq("product_id", product.id)
        .eq("is_active", true)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.category_id) setFixedCategoryId(data.category_id as string);
        });
    } else {
      setName("");
      setCategory("영양제");
      setSubCategory("");
      setBrand("");
      setNotes("");
      setIsActive(false);
      setPrices([]);
      setPaymentDay("11");
      setMonthlyCostInput("");
      setFixedCategoryId("");
    }
    setPriceDraft("");
    setSiteDraft("");
    setDateDraft(todayIsoDate());
    setEditingIdx(null);
  }, [product, open]);

  // 가계부 카테고리 기본값 — 로드된 카테고리가 없으면 "기타지출" 또는 첫 expense.
  useEffect(() => {
    if (fixedCategoryId) return;
    if (expenseCategories.length === 0) return;
    const def =
      expenseCategories.find((c) => c.name === "기타지출") || expenseCategories[0];
    if (def) setFixedCategoryId(def.id);
  }, [expenseCategories, fixedCategoryId]);

  const resetDraft = () => {
    setPriceDraft("");
    setSiteDraft("");
    setDateDraft(todayIsoDate());
    setEditingIdx(null);
  };

  const commitPrice = () => {
    const priceNum = parseInt(priceDraft);
    if (!priceDraft || !(priceNum > 0)) return;
    const entry: PriceEntry = {
      price: String(priceNum),
      site_url: siteDraft.trim(),
      purchased_at: dateDraft || todayIsoDate(),
    };
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
    setDateDraft(p.purchased_at || todayIsoDate());
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

    // 사용자가 입력한 월 비용 우선, 없으면 최저가 폴백.
    const userMonthlyCost = parseInt(monthlyCostInput);
    const monthlyCost = userMonthlyCost > 0 ? userMonthlyCost : minPrice;
    // 결제일 1~31 클램프.
    const day = Math.min(31, Math.max(1, parseInt(paymentDay) || 11));

    const { error, data } = await onSave({
      name: name.trim(),
      category,
      sub_category: subCategory.trim() || null,
      brand: brand.trim() || null,
      notes: notes.trim() || null,
      link: validPrices[0]?.site_url || null,
      is_active: isActive,
      monthly_cost: monthlyCost,
      monthly_consumption: product?.monthly_consumption ?? 1,
      default_payment_day: day,
    });
    if (error || !data) {
      setSaving(false);
      toast.error("저장 실패");
      return;
    }

    const productId = data.id;

    // 2. 가격 목록 업데이트 — 기존 것 삭제 후 새로 삽입 (구매일 보존).
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
          purchased_at: p.purchased_at || todayIsoDate(),
          store: null,
          link: p.site_url.trim() || null,
          notes: null,
          user_id: userId,
        }))
      );
    }

    // 3. 고정비 등록/해제 — 사용자 선택 카테고리·결제일·월비용 사용.
    if (isActive && monthlyCost && fixedCategoryId) {
      await upsertFixedFromProduct({
        productId,
        productName: name.trim(),
        monthlyCost,
        paymentDay: day,
        categoryId: fixedCategoryId,
      });
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
      footerStart={
        product && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onDelete(product)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            삭제
          </Button>
        ) : undefined
      }
    >
        <div className="flex flex-col gap-4">
          <FormField label="제품명" required htmlFor="product-name">
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 오메가3"
              className={FORM_INPUT_PRIMARY}
            />
          </FormField>

          {/* 분류 · 세부분류 — 항상 같은 행 (2열) */}
          <div className="grid grid-cols-2 gap-2">
            <FormField label="분류">
              <TagInput
                selectedTags={category ? [category] : []}
                allTags={categoryTags}
                onChange={(tags) => setCategory((tags[tags.length - 1] || "") as ProductCategory)}
                onAddTag={addMidCategory}
                onDeleteTag={deleteMidCategory}
                onUpdateTagColor={updateMidCategoryColor}
                placeholder="검색·추가"
              />
            </FormField>
            <FormField label="세부분류">
              <TagInput
                selectedTags={subCategory ? [subCategory] : []}
                allTags={subTags}
                onChange={(tags) => setSubCategory(tags[tags.length - 1] || "")}
                onAddTag={addTag}
                onDeleteTag={deleteTag}
                onUpdateTagColor={updateTagColor}
                placeholder="검색·추가"
              />
            </FormField>
          </div>

          {/* 브랜드 — product-level 메타 정보. 분류 다음 행에 배치. */}
          <FormField label="브랜드">
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="브랜드명"
              className={FORM_INPUT_COMPACT}
            />
          </FormField>

          {/* ── 가격 추가 sub-form ──
              이전엔 브랜드까지 같은 zone 안에 있어 "추가" 버튼 의미가 모호했음.
              가격 entry 전용 영역으로 분리. 테두리 대신 옅은 배경 + 라벨로 시각 구분. */}
          <div className="flex flex-col gap-2.5 rounded-lg bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                가격 추가
              </h4>
              {editingIdx !== null && (
                <button
                  type="button"
                  onClick={resetDraft}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  새 가격 입력
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="가격">
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
                  className={FORM_INPUT_COMPACT}
                />
              </FormField>
              <FormField label="구매일">
                <DatePicker
                  value={dateDraft}
                  onChange={setDateDraft}
                  className={`${FORM_INPUT_COMPACT} w-full min-w-0`}
                />
              </FormField>
            </div>
            <FormField label="URL">
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
                className={FORM_INPUT_COMPACT}
              />
            </FormField>
            <Button
              type="button"
              variant={editingIdx !== null ? "default" : "outline"}
              size="sm"
              onClick={commitPrice}
              disabled={!priceDraft || !(parseInt(priceDraft) > 0)}
              className="w-full"
            >
              {editingIdx !== null ? (
                "이 가격 수정"
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 mr-1" /> 가격 추가
                </>
              )}
            </Button>
          </div>

          {/* 등록된 가격 — sub-form 밖으로 분리해 시각 무게 줄임. 비어 있으면 영역 자체 숨김. */}
          {prices.length > 0 && (() => {
            const sorted = [...prices]
              .map((p, originalIdx) => ({ p, originalIdx }))
              .sort((a, b) => parseInt(a.p.price) - parseInt(b.p.price));
            const minPriceStr = sorted[0]?.p.price;
            return (
              <div className="flex flex-col gap-1.5">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  등록된 가격 ({prices.length})
                </h4>
                <ul className="rounded-lg border bg-card divide-y divide-border/60 overflow-hidden">
                  {sorted.map(({ p, originalIdx }) => {
                    const isMin = p.price === minPriceStr;
                    const isEditing = editingIdx === originalIdx;
                    return (
                      <li
                        key={originalIdx}
                        onClick={() => startEditPrice(originalIdx)}
                        className={`group flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition-colors ${
                          isEditing ? "bg-primary/10" : "hover:bg-accent/50"
                        }`}
                      >
                        <span className="w-4 text-center text-yellow-500 shrink-0">
                          {isMin ? (
                            <Crown className="h-3.5 w-3.5 inline" />
                          ) : null}
                        </span>
                        <span
                          className={`tabular-nums font-semibold tracking-tight flex-1 ${
                            isMin ? "text-yellow-700 dark:text-yellow-500" : "text-foreground"
                          }`}
                        >
                          {parseInt(p.price).toLocaleString()}원
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
              </div>
            );
          })()}

          {/* 고정비 등록 + 옵션 (결제일·월비용·가계부 카테고리 + 미리보기) */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className={FORM_HINT}>고정비에 추가</span>
            </label>
            {isActive && (() => {
              const validPrices = prices
                .map((p) => parseInt(p.price))
                .filter((n) => Number.isFinite(n) && n > 0);
              const minPrice = validPrices.length ? Math.min(...validPrices) : null;
              const previewCost =
                parseInt(monthlyCostInput) > 0
                  ? parseInt(monthlyCostInput)
                  : minPrice;
              const dayNum = Math.min(31, Math.max(1, parseInt(paymentDay) || 11));
              return (
                <div className="ml-6 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="결제일">
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={paymentDay}
                        onChange={(e) => setPaymentDay(e.target.value)}
                        className={FORM_INPUT_COMPACT}
                      />
                    </FormField>
                    <FormField label="월 비용">
                      <Input
                        type="number"
                        value={monthlyCostInput}
                        onChange={(e) => setMonthlyCostInput(e.target.value)}
                        placeholder={minPrice ? String(minPrice) : "0"}
                        className={FORM_INPUT_COMPACT}
                      />
                    </FormField>
                  </div>
                  <FormField label="가계부 카테고리">
                    <Select
                      value={fixedCategoryId}
                      onValueChange={(v) => setFixedCategoryId(v ?? "")}
                    >
                      <SelectTrigger className={FORM_INPUT_COMPACT}>
                        {expenseCategories.find((c) => c.id === fixedCategoryId)?.name ||
                          "선택"}
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {previewCost && previewCost > 0 ? (
                      <>
                        매월 <strong className="text-foreground">{dayNum}일</strong>에{" "}
                        <strong className="text-foreground">
                          ₩{previewCost.toLocaleString()}
                        </strong>{" "}
                        차감 예정
                      </>
                    ) : (
                      "가격을 1개 이상 추가하면 월 비용이 자동 계산됩니다."
                    )}
                  </p>
                </div>
              );
            })()}
          </div>

          <FormField label="메모">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="성분·특이사항 등"
            />
          </FormField>

        </div>
    </FormPage>
    </>
  );
}

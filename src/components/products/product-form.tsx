"use client";

import { useState, useEffect } from "react";
import FormPage from "@/components/ui/form-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import DatePicker from "@/components/ui/date-picker";
import NumberWheel from "@/components/ui/number-wheel";
import { Trash2 } from "lucide-react";
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
} from "@/lib/form-classes";

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

/**
 * 쇼핑기록 제품 폼.
 *
 * 레이아웃:
 *   제품명
 *   브랜드 │ 구매일
 *   분류 │ 세부분류 │ 가격
 *   URL
 *   메모
 *   [고정비에 추가] (체크 시 결제일 + 반복 개월 수)
 *
 * 가격은 단일 값(목록 기능 제거). product_purchases 에 1행만 유지 (저장 시 기존 삭제 + 1개 insert).
 * "고정비에 추가" 시 가계부 카테고리는 product.category 와 같은 이름의 expense_categories 행을 매칭,
 * 없으면 "기타지출" 폴백. 월 비용은 입력한 가격을 그대로 사용.
 */
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
  // 단일 가격 + 구매일 + URL.
  const [price, setPrice] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(todayIsoDate());
  const [siteUrl, setSiteUrl] = useState("");
  const [paymentDay, setPaymentDay] = useState("11");
  // 고정비 추가 시 일괄 생성할 거래 개월 수 (캘린더 반복 횟수와 동일 의미).
  const [repeatMonths, setRepeatMonths] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const userId = useCurrentUserId();

  const { tags: subTags, addTag, deleteTag, updateTagColor } = useProductSubTags(category);
  const { addFixed, deleteFixedByProduct } = useFixedExpenses();
  // expense_categories 룩업용 — 분류 이름 매칭 후 fallback "기타지출".
  const todayIso = todayIsoDate();
  const { categories: expCategories } = useTransactions(todayIso, todayIso);
  const expenseCategories = expCategories.filter((c) => c.type === "expense");

  // 폼 열릴 때 product 값으로 초기화 + 가격 1행 로드.
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
      setPrice(product.monthly_cost ? String(product.monthly_cost) : "");
      setRepeatMonths(1);
      // 가격 이력 → 가장 최근 1행만 사용
      supabase
        .from("product_purchases")
        .select("total_price, link, purchased_at")
        .eq("product_id", product.id)
        .order("purchased_at", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const p = data[0] as { total_price: number; link: string | null; purchased_at: string | null };
            setPrice(String(p.total_price));
            setSiteUrl(p.link || "");
            setPurchasedAt(p.purchased_at || todayIsoDate());
          } else {
            setSiteUrl(product.link || "");
            setPurchasedAt(todayIsoDate());
          }
        });
    } else {
      setName("");
      setCategory("영양제");
      setSubCategory("");
      setBrand("");
      setNotes("");
      setIsActive(false);
      setPrice("");
      setSiteUrl("");
      setPurchasedAt(todayIsoDate());
      setPaymentDay("11");
      setRepeatMonths(1);
    }
  }, [product, open]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const priceNum = parseInt(price) || null;
    const day = Math.min(31, Math.max(1, parseInt(paymentDay) || 11));

    // 1. 제품 저장
    const { error, data } = await onSave({
      name: name.trim(),
      category,
      sub_category: subCategory.trim() || null,
      brand: brand.trim() || null,
      notes: notes.trim() || null,
      link: siteUrl.trim() || null,
      is_active: isActive,
      monthly_cost: priceNum,
      monthly_consumption: product?.monthly_consumption ?? 1,
      default_payment_day: day,
    });
    if (error || !data) {
      setSaving(false);
      toast.error("저장 실패");
      return;
    }
    const productId = data.id;

    // 2. 가격 1행 — 기존 모두 삭제 후 1행 삽입 (있을 때만).
    await supabase.from("product_purchases").delete().eq("product_id", productId);
    if (priceNum && userId) {
      await supabase.from("product_purchases").insert({
        product_id: productId,
        total_price: priceNum,
        points: 0,
        quantity: 1,
        quantity_unit: "개",
        purchased_at: purchasedAt || todayIsoDate(),
        store: null,
        link: siteUrl.trim() || null,
        notes: null,
        user_id: userId,
      });
    }

    // 3. 고정비 등록/해제.
    //  - 가계부 카테고리: product.category 동명 expense_category → 없으면 "기타지출".
    //  - 월 비용: 입력한 가격.
    //  - 신규 활성화일 때만 N개월 거래 일괄 생성. 기존 활성이면 업데이트만.
    const wasActive = product?.is_active ?? false;
    if (isActive && priceNum) {
      const expCat =
        expenseCategories.find((c) => c.name === category) ||
        expenseCategories.find((c) => c.name === "기타지출") ||
        expenseCategories[0];
      if (expCat) {
        if (!wasActive) {
          // 신규: addFixed 가 fixed_expenses + N개월 expenses 일괄 생성.
          await addFixed(
            {
              title: name.trim(),
              amount: priceNum,
              category_id: expCat.id,
              description: name.trim(),
              day_of_month: day,
              type: "expense",
              payment_method: "카드",
              product_id: productId,
            },
            repeatMonths,
          );
        } else {
          // 기존 활성: fixed_expenses 만 업데이트 (이번달 거래는 그대로).
          const { data: existing } = await supabase
            .from("fixed_expenses")
            .select("id")
            .eq("product_id", productId)
            .eq("is_active", true)
            .maybeSingle();
          if (existing) {
            await supabase
              .from("fixed_expenses")
              .update({
                amount: priceNum,
                day_of_month: day,
                description: name.trim(),
                category_id: expCat.id,
              })
              .eq("id", existing.id);
          }
        }
      }
    } else if (!isActive && wasActive) {
      await deleteFixedByProduct(productId);
    }

    setSaving(false);
    onOpenChange(false);
  };

  return (
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
        {/* 1행: 제품명 */}
        <FormField label="제품명" required htmlFor="product-name">
          <Input
            id="product-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 오메가3"
            className={FORM_INPUT_PRIMARY}
          />
        </FormField>

        {/* 2행: 브랜드 │ 구매일 */}
        <div className="grid grid-cols-2 gap-2">
          <FormField label="브랜드">
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="브랜드명"
              className={FORM_INPUT_COMPACT}
            />
          </FormField>
          <FormField label="구매일">
            <DatePicker
              value={purchasedAt}
              onChange={setPurchasedAt}
              className={`${FORM_INPUT_COMPACT} w-full min-w-0`}
            />
          </FormField>
        </div>

        {/* 3행: 분류 │ 세부분류 │ 가격 */}
        <div className="grid grid-cols-3 gap-2">
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
          <FormField label="가격">
            <Input
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="35000"
              className={FORM_INPUT_COMPACT}
            />
          </FormField>
        </div>

        {/* 4행: URL */}
        <FormField label="URL">
          <Input
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://..."
            className={FORM_INPUT_COMPACT}
          />
        </FormField>

        {/* 5행: 메모 */}
        <FormField label="메모">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="성분·특이사항 등"
          />
        </FormField>

        {/* 고정비에 추가 — 체크 시 결제일 + 반복 개월 수만 입력.
            카테고리는 위의 "분류" 와 같은 이름으로 자동 매핑(없으면 "기타지출"). 월 비용은 위 가격 사용. */}
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
            const previewCost = parseInt(price) || 0;
            const dayNum = Math.min(31, Math.max(1, parseInt(paymentDay) || 11));
            const wasActive = product?.is_active ?? false;
            return (
              <div className="ml-6 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="결제일">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      value={paymentDay}
                      onChange={(e) => setPaymentDay(e.target.value)}
                      className={FORM_INPUT_COMPACT}
                    />
                  </FormField>
                  {!wasActive && (
                    <FormField label="반복">
                      <div className="flex items-center gap-2">
                        <NumberWheel
                          value={repeatMonths}
                          onChange={setRepeatMonths}
                          min={1}
                          max={120}
                          allowInfinity
                        />
                        <span className="text-xs text-muted-foreground">개월</span>
                      </div>
                    </FormField>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-tight">
                  {previewCost > 0 ? (
                    <>
                      매월 <strong className="text-foreground">{dayNum}일</strong>에{" "}
                      <strong className="text-foreground">
                        ₩{previewCost.toLocaleString()}
                      </strong>
                      {!wasActive && (
                        <>
                          {" "}—{" "}
                          <strong className="text-foreground">
                            {repeatMonths === -1 ? "120" : repeatMonths}개월
                          </strong>{" "}
                          일괄 등록
                        </>
                      )}
                    </>
                  ) : (
                    "가격을 입력하면 월 비용이 자동 계산됩니다."
                  )}
                </p>
              </div>
            );
          })()}
        </div>
      </div>
    </FormPage>
  );
}

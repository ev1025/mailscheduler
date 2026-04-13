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
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ExternalLink, Crown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  useProductPurchases,
  computeUnitPrice,
} from "@/hooks/use-product-purchases";
import { useFixedExpenses } from "@/hooks/use-fixed-expenses";
import { useTransactions } from "@/hooks/use-transactions";
import { toast } from "sonner";
import type { Product } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onUpdate: (updates: Partial<Product>) => void;
}

export default function ProductDetailDialog({
  open,
  onOpenChange,
  product,
  onUpdate,
}: Props) {
  const { purchases, addPurchase, deletePurchase } = useProductPurchases(
    product?.id || null
  );
  const { upsertFixedFromProduct, deleteFixedByProduct } = useFixedExpenses();
  const now = new Date();
  const { categories } = useTransactions(now.getFullYear(), now.getMonth() + 1);
  const [monthlyCost, setMonthlyCost] = useState("");

  useEffect(() => {
    if (product) setMonthlyCost(String(product.monthly_cost ?? ""));
  }, [product]);

  const [showForm, setShowForm] = useState(false);
  const [totalPrice, setTotalPrice] = useState("");
  const [points, setPoints] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("개");
  const [store, setStore] = useState("");
  const [purchaseLink, setPurchaseLink] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    if (!showForm) {
      setTotalPrice("");
      setPoints("");
      setQuantity("");
      setStore("");
      setPurchaseLink("");
    }
  }, [showForm]);

  if (!product) return null;

  const handleAddPurchase = async () => {
    if (!totalPrice || !quantity) return;
    await addPurchase({
      product_id: product.id,
      total_price: parseInt(totalPrice),
      points: parseInt(points) || 0,
      quantity: parseFloat(quantity),
      quantity_unit: unit,
      purchased_at: purchaseDate,
      store: store.trim() || null,
      link: purchaseLink.trim() || null,
      notes: null,
    });
    setShowForm(false);
  };

  const minUnitPrice = purchases.length
    ? Math.min(...purchases.map(computeUnitPrice))
    : 0;

  const chartData = [...purchases]
    .sort(
      (a, b) =>
        new Date(a.purchased_at).getTime() - new Date(b.purchased_at).getTime()
    )
    .map((p) => ({
      date: p.purchased_at.slice(5),
      price: Math.round(computeUnitPrice(p)),
    }));

  const toggleActive = async () => {
    const nextActive = !product.is_active;
    onUpdate({ is_active: nextActive });
    if (nextActive) {
      const cost = parseInt(monthlyCost) || 0;
      if (cost <= 0) {
        toast.info("월간비용을 먼저 입력하세요");
        return;
      }
      // 기본 카테고리 찾기 (식비/기타지출 등)
      const expenseCat =
        categories.find(
          (c) =>
            c.type === "expense" &&
            (c.name === "기타지출" || c.name.includes("생활"))
        ) || categories.find((c) => c.type === "expense");
      if (!expenseCat) {
        toast.error("가계부 카테고리를 먼저 설정하세요");
        return;
      }
      const { error } = await upsertFixedFromProduct({
        productId: product.id,
        productName: product.name,
        monthlyCost: cost,
        paymentDay: product.default_payment_day || 11,
        categoryId: expenseCat.id,
      });
      if (!error) toast.success(`가계부 고정비에 ₩${cost.toLocaleString()}/월 등록`);
    } else {
      await deleteFixedByProduct(product.id);
      toast.success("고정비에서 제거됨");
    }
  };

  const handleMonthlyCostSave = async () => {
    const cost = parseInt(monthlyCost) || 0;
    onUpdate({ monthly_cost: cost });
    if (product.is_active && cost > 0) {
      const expenseCat =
        categories.find(
          (c) =>
            c.type === "expense" &&
            (c.name === "기타지출" || c.name.includes("생활"))
        ) || categories.find((c) => c.type === "expense");
      if (expenseCat) {
        await upsertFixedFromProduct({
          productId: product.id,
          productName: product.name,
          monthlyCost: cost,
          paymentDay: product.default_payment_day || 11,
          categoryId: expenseCat.id,
        });
        toast.success("고정비 갱신됨");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{product.category}</Badge>
              {product.sub_category && (
                <Badge variant="secondary">{product.sub_category}</Badge>
              )}
            </div>
            <button
              type="button"
              onClick={toggleActive}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${
                product.is_active
                  ? "border-green-500/60 bg-green-500/10 text-green-600"
                  : "text-muted-foreground"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  product.is_active ? "bg-green-500" : "bg-muted-foreground/40"
                }`}
              />
              {product.is_active ? "사용 중" : "사용 안 함"}
            </button>
          </div>
          <DialogTitle className="text-xl">{product.name}</DialogTitle>
          {product.brand && (
            <p className="text-sm text-muted-foreground">{product.brand}</p>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {product.notes && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              {product.notes}
            </div>
          )}

          {/* 월간비용 → 고정비 연동 */}
          <div className="flex items-end gap-2 rounded-lg border p-3 bg-blue-50/30">
            <div className="flex-1 flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">
                월간 비용 (고정비 자동 등록용)
              </Label>
              <Input
                type="number"
                value={monthlyCost}
                onChange={(e) => setMonthlyCost(e.target.value)}
                placeholder="예: 38000"
                className="h-8"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleMonthlyCostSave}
              className="h-8"
            >
              저장
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground -mt-2">
            💳 사용 중으로 켜면 가계부 고정비에 매월{" "}
            {product.default_payment_day || 11}일 결제로 자동 등록됩니다
          </p>

          {chartData.length >= 2 && (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-2">
                실제단가 추이 ({chartData.length}회 구매)
              </p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip
                      formatter={(v) => `₩${Number(v).toLocaleString()}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#3B82F6"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">구매 이력</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(!showForm)}
              >
                <Plus className="mr-1 h-3 w-3" />
                {showForm ? "취소" : "구매 추가"}
              </Button>
            </div>

            {showForm && (
              <div className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">
                      가격
                    </Label>
                    <Input
                      type="number"
                      value={totalPrice}
                      onChange={(e) => setTotalPrice(e.target.value)}
                      placeholder="38000"
                      className="h-8"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">
                      포인트
                    </Label>
                    <Input
                      type="number"
                      value={points}
                      onChange={(e) => setPoints(e.target.value)}
                      placeholder="0"
                      className="h-8"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">
                      구매일
                    </Label>
                    <Input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">
                      용량
                    </Label>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="100"
                      className="h-8"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">
                      단위
                    </Label>
                    <Input
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="ml/g/개"
                      className="h-8"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">
                      구매처
                    </Label>
                    <Input
                      value={store}
                      onChange={(e) => setStore(e.target.value)}
                      placeholder="네이버브랜드"
                      className="h-8"
                    />
                  </div>
                </div>
                <Input
                  value={purchaseLink}
                  onChange={(e) => setPurchaseLink(e.target.value)}
                  placeholder="구매 링크 (선택)"
                  className="h-8"
                />
                <Button size="sm" onClick={handleAddPurchase}>
                  추가
                </Button>
              </div>
            )}

            {purchases.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                구매 이력이 없습니다
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium">
                        날짜
                      </th>
                      <th className="text-right px-2 py-1.5 font-medium">
                        가격
                      </th>
                      <th className="text-right px-2 py-1.5 font-medium">
                        용량
                      </th>
                      <th className="text-right px-2 py-1.5 font-medium">
                        실제단가
                      </th>
                      <th className="text-left px-2 py-1.5 font-medium">
                        구매처
                      </th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => {
                      const up = computeUnitPrice(p);
                      const isMin = up === minUnitPrice;
                      return (
                        <tr
                          key={p.id}
                          className="border-t hover:bg-accent/40 group"
                        >
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {p.purchased_at}
                          </td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">
                            ₩{p.total_price.toLocaleString()}
                            {p.points > 0 && (
                              <span className="text-muted-foreground">
                                {" "}
                                (-{p.points.toLocaleString()})
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">
                            {p.quantity}
                            {p.quantity_unit}
                          </td>
                          <td
                            className={`px-2 py-1.5 text-right whitespace-nowrap font-medium ${
                              isMin ? "text-green-600" : ""
                            }`}
                          >
                            {isMin && (
                              <Crown className="inline h-3 w-3 mr-1" />
                            )}
                            ₩{Math.round(up).toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {p.link ? (
                              <a
                                href={p.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-primary hover:underline"
                              >
                                {p.store || "링크"}
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            ) : (
                              p.store || "-"
                            )}
                          </td>
                          <td className="px-1 py-1.5">
                            <button
                              type="button"
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                              onClick={() => deletePurchase(p.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

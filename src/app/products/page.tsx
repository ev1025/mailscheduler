"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Search,
  Trash2,
  ExternalLink,
  Crown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useProducts } from "@/hooks/use-products";
import ProductForm from "@/components/products/product-form";
import ProductDetailDialog from "@/components/products/product-detail-dialog";
import { computeUnitPrice } from "@/hooks/use-product-purchases";
import type { Product, ProductCategory, ProductPurchase } from "@/types";
import { toast } from "sonner";

const CATEGORY_COLORS: Record<string, string> = {
  영양제: "#22C55E",
  화장품: "#EC4899",
  단백질: "#F59E0B",
  음식: "#EF4444",
  생필품: "#3B82F6",
  구독: "#8B5CF6",
  기타: "#6B7280",
};

const CATEGORIES: (ProductCategory | "전체")[] = [
  "전체",
  "영양제",
  "화장품",
  "단백질",
  "음식",
  "생필품",
  "구독",
  "기타",
];

// 제품별 최저단가 요약
interface ProductStat {
  bestUnitPrice: number | null;
  purchaseCount: number;
}

export default function ProductsPage() {
  const { products, loading, addProduct, updateProduct, deleteProduct } =
    useProducts();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    ProductCategory | "전체"
  >("전체");
  const [stats, setStats] = useState<Record<string, ProductStat>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 모든 제품의 최저단가 계산 (한 번의 쿼리로)
  useEffect(() => {
    if (products.length === 0) {
      setStats({});
      return;
    }
    const productIds = products.map((p) => p.id);
    supabase
      .from("product_purchases")
      .select("product_id, total_price, points, quantity")
      .in("product_id", productIds)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, ProductStat> = {};
        for (const p of data as (ProductPurchase & { product_id: string })[]) {
          const up = computeUnitPrice(p as ProductPurchase);
          const s = map[p.product_id] || {
            bestUnitPrice: null,
            purchaseCount: 0,
          };
          s.purchaseCount += 1;
          if (s.bestUnitPrice === null || up < s.bestUnitPrice) {
            s.bestUnitPrice = up;
          }
          map[p.product_id] = s;
        }
        setStats(map);
      });
  }, [products]);

  // 필터링된 제품
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== "전체" && p.category !== categoryFilter)
        return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q) ||
          (p.sub_category || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, categoryFilter, search]);

  // 카테고리 → 소분류 → 제품들 그룹핑
  const grouped = useMemo(() => {
    const g: Record<string, Record<string, Product[]>> = {};
    for (const p of filtered) {
      const cat = p.category;
      const sub = p.sub_category || "기타";
      if (!g[cat]) g[cat] = {};
      if (!g[cat][sub]) g[cat][sub] = [];
      g[cat][sub].push(p);
    }
    // 각 소분류 내에서 최저단가순 정렬 (랭킹)
    for (const cat of Object.keys(g)) {
      for (const sub of Object.keys(g[cat])) {
        g[cat][sub].sort((a, b) => {
          const ap = stats[a.id]?.bestUnitPrice ?? Infinity;
          const bp = stats[b.id]?.bestUnitPrice ?? Infinity;
          return ap - bp;
        });
      }
    }
    return g;
  }, [filtered, stats]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 그룹 전체 자동 펼침 (필터 변경 시)
  useEffect(() => {
    const keys = new Set<string>();
    for (const cat of Object.keys(grouped)) {
      for (const sub of Object.keys(grouped[cat])) {
        keys.add(`${cat}::${sub}`);
      }
    }
    setExpandedGroups(keys);
  }, [categoryFilter, search]);

  const handleSave = async (
    data: Omit<Product, "id" | "created_at" | "updated_at">
  ) => {
    if (editing) {
      const result = await updateProduct(editing.id, data);
      if (!result.error) toast.success("수정되었습니다");
      return result;
    } else {
      const result = await addProduct(data);
      if (!result.error) toast.success("추가되었습니다");
      return { error: result.error };
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold">생필품 비교</h2>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          제품 추가
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제품명/브랜드/소분류 검색"
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const active = categoryFilter === c;
            const color = c === "전체" ? "#6B7280" : CATEGORY_COLORS[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryFilter(c)}
                className="rounded-full border px-3 py-1 text-xs transition-all"
                style={
                  active
                    ? {
                        borderColor: color,
                        backgroundColor: color + "20",
                        color,
                        fontWeight: 600,
                      }
                    : { color: "#6B7280" }
                }
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-muted-foreground">
            {products.length === 0
              ? "등록된 제품이 없습니다"
              : "검색 결과가 없습니다"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.keys(grouped).map((cat) => {
            const catColor = CATEGORY_COLORS[cat] || "#6B7280";
            const subCats = Object.keys(grouped[cat]);
            return (
              <section key={cat} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: catColor }}
                  />
                  <h3
                    className="text-sm font-bold"
                    style={{ color: catColor }}
                  >
                    {cat}
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    ({subCats.length}개 소분류)
                  </span>
                </div>

                {subCats.map((sub) => {
                  const groupKey = `${cat}::${sub}`;
                  const expanded = expandedGroups.has(groupKey);
                  const list = grouped[cat][sub];
                  return (
                    <div
                      key={groupKey}
                      className="rounded-lg border bg-card overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupKey)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors"
                      >
                        {expanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="text-sm font-semibold">{sub}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 ml-auto"
                        >
                          {list.length}개 제품
                        </Badge>
                      </button>
                      {expanded && (
                        <div className="border-t">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/30 text-muted-foreground">
                              <tr>
                                <th className="text-center px-2 py-2 font-medium w-10">
                                  순위
                                </th>
                                <th className="text-left px-2 py-2 font-medium">
                                  제품
                                </th>
                                <th className="text-left px-2 py-2 font-medium hidden sm:table-cell">
                                  브랜드
                                </th>
                                <th className="text-right px-2 py-2 font-medium whitespace-nowrap">
                                  최저단가
                                </th>
                                <th className="text-right px-2 py-2 font-medium hidden md:table-cell whitespace-nowrap">
                                  구매
                                </th>
                                <th className="w-8"></th>
                                <th className="w-8"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((p, idx) => {
                                const stat = stats[p.id];
                                const isTop3 = idx < 3;
                                return (
                                  <tr
                                    key={p.id}
                                    className="border-t hover:bg-accent/40 cursor-pointer group"
                                    onClick={() => setDetailProduct(p)}
                                  >
                                    <td className="text-center px-2 py-2 whitespace-nowrap">
                                      <span
                                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                          idx === 0
                                            ? "bg-yellow-100 text-yellow-700"
                                            : idx === 1
                                              ? "bg-gray-100 text-gray-700"
                                              : idx === 2
                                                ? "bg-orange-100 text-orange-700"
                                                : "text-muted-foreground"
                                        }`}
                                      >
                                        {isTop3 ? idx + 1 : idx + 1}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2">
                                      <div className="flex items-center gap-1.5">
                                        {p.is_active && (
                                          <span
                                            className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0"
                                            title="사용 중"
                                          />
                                        )}
                                        <span className="font-medium line-clamp-1">
                                          {p.name}
                                        </span>
                                        {idx === 0 && stat?.bestUnitPrice && (
                                          <Crown className="h-3 w-3 text-yellow-500 shrink-0" />
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-2 py-2 text-muted-foreground hidden sm:table-cell">
                                      {p.brand || "-"}
                                    </td>
                                    <td className="px-2 py-2 text-right whitespace-nowrap font-medium">
                                      {stat?.bestUnitPrice
                                        ? `₩${Math.round(stat.bestUnitPrice).toLocaleString()}`
                                        : "-"}
                                    </td>
                                    <td className="px-2 py-2 text-right text-muted-foreground hidden md:table-cell whitespace-nowrap">
                                      {stat?.purchaseCount ?? 0}회
                                    </td>
                                    <td className="px-1 py-2">
                                      {p.link && (
                                        <a
                                          href={p.link}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-muted-foreground hover:text-primary"
                                          title="구매링크"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      )}
                                    </td>
                                    <td className="px-1 py-2">
                                      <button
                                        type="button"
                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (
                                            confirm(`"${p.name}" 삭제할까요?`)
                                          ) {
                                            await deleteProduct(p.id);
                                            toast.success("삭제되었습니다");
                                          }
                                        }}
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
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        onSave={handleSave}
      />
      <ProductDetailDialog
        open={!!detailProduct}
        onOpenChange={(o) => !o && setDetailProduct(null)}
        product={detailProduct}
        onUpdate={(updates) => {
          if (detailProduct) {
            updateProduct(detailProduct.id, updates);
            setDetailProduct({ ...detailProduct, ...updates });
          }
        }}
      />
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useProducts } from "@/hooks/use-products";
import ProductForm from "@/components/products/product-form";
import ProductDetailDialog from "@/components/products/product-detail-dialog";
import type { Product, ProductCategory } from "@/types";
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
        <h2 className="text-2xl font-bold">생필품</h2>
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
            placeholder="제품명/브랜드 검색"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const color = CATEGORY_COLORS[p.category] || "#6B7280";
            return (
              <div
                key={p.id}
                className="group relative flex flex-col gap-2 rounded-xl border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setDetailProduct(p)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <Badge
                      className="text-[10px] h-5"
                      style={{
                        backgroundColor: color + "20",
                        color,
                        borderColor: color + "40",
                      }}
                    >
                      {p.category}
                    </Badge>
                    {p.sub_category && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        {p.sub_category}
                      </Badge>
                    )}
                  </div>
                  {p.is_active && (
                    <span
                      className="h-2 w-2 rounded-full bg-green-500 shrink-0 mt-1.5"
                      title="사용 중"
                    />
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-sm line-clamp-1">
                    {p.name}
                  </h3>
                  {p.brand && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {p.brand}
                    </p>
                  )}
                </div>

                {p.notes && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {p.notes}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  {p.link ? (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      구매링크 <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(p);
                        setFormOpen(true);
                      }}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`"${p.name}" 삭제할까요?`)) {
                          await deleteProduct(p.id);
                          toast.success("삭제되었습니다");
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
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

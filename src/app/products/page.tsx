"use client";

import { Suspense, useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Crown,
  ChevronDown,
  ChevronRight,
  Wallet,
  ShoppingBag,
  Menu,
  GripVertical,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProducts } from "@/hooks/use-products";
import { useProductCategories } from "@/hooks/use-product-categories";
import ProductForm from "@/components/products/product-form";
import type { Product } from "@/types";
import PageHeader from "@/components/layout/page-header";
import PromptDialog from "@/components/ui/prompt-dialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { PAGE_ACTION_BUTTON } from "@/lib/form-classes";

const CATEGORY_COLORS: Record<string, string> = {
  영양제: "#22C55E",
  화장품: "#EC4899",
  단백질: "#F59E0B",
  음식: "#EF4444",
  생필품: "#3B82F6",
  구독: "#8B5CF6",
  기타: "#6B7280",
};

// CATEGORY_COLORS의 키와 동일 — 기본 분류는 삭제 버튼을 숨기기 위한 체크용
const BUILTIN_CATEGORIES = new Set(Object.keys(CATEGORY_COLORS));

interface ProductStat {
  minPrice: number | null;
}

function ProductRow({
  p,
  idx,
  stat,
  onEdit,
}: {
  p: Product;
  idx: number;
  stat?: ProductStat;
  onEdit: (p: Product) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: p.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-t hover:bg-accent/40 cursor-pointer group"
      onClick={() => onEdit(p)}
    >
      <td className="text-center px-1 py-1.5 whitespace-nowrap w-6">
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      </td>
      <td className="text-center px-1 py-1.5 whitespace-nowrap w-8">
        <span
          className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
            idx === 0
              ? "bg-yellow-100 text-yellow-700"
              : idx === 1
                ? "bg-gray-100 text-gray-700"
                : idx === 2
                  ? "bg-orange-100 text-orange-700"
                  : "text-muted-foreground"
          }`}
        >
          {idx + 1}
        </span>
      </td>
      <td className="px-2 py-1.5 w-auto">
        <div className="flex items-center gap-1 min-w-0">
          <span className="font-medium text-xs">{p.name}</span>
          {idx === 0 && stat?.minPrice && (
            <Crown className="h-3 w-3 text-yellow-500 shrink-0" />
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
        {p.brand || "-"}
      </td>
      <td className="px-2 py-1.5 text-right whitespace-nowrap text-xs font-semibold">
        {stat?.minPrice
          ? `₩${stat.minPrice.toLocaleString()}`
          : "-"}
      </td>
    </tr>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsPageInner />
    </Suspense>
  );
}

function ProductsPageInner() {
  const { products, loading, addProduct, updateProduct, deleteProduct } =
    useProducts();
  const { categories: midCategories, addCategory, deleteCategory: deleteMidCategory } = useProductCategories();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [statsTick, setStatsTick] = useState(0);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get("category") || "전체";
  const setCategoryFilter = (c: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (c === "전체") params.delete("category");
    else params.set("category", c);
    const qs = params.toString();
    router.replace(qs ? `/products?${qs}` : "/products", { scroll: false });
  };
  const [stats, setStats] = useState<Record<string, ProductStat>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  // 커스텀 순서 (sub-category별)
  const [customOrder, setCustomOrder] = useState<Record<string, string[]>>({});
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<string | null>(null);

  // 제품 ID별 최저 가격
  useEffect(() => {
    if (products.length === 0) {
      setStats({});
      return;
    }
    const productIds = products.map((p) => p.id);
    supabase
      .from("product_purchases")
      .select("product_id, total_price")
      .in("product_id", productIds)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, ProductStat> = {};
        for (const p of data as { product_id: string; total_price: number }[]) {
          const s = map[p.product_id] || { minPrice: null };
          if (s.minPrice === null || p.total_price < s.minPrice) {
            s.minPrice = p.total_price;
          }
          map[p.product_id] = s;
        }
        setStats(map);
      });
  }, [products, statsTick]);

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

  // 카테고리 → 소분류 → 제품들
  const grouped = useMemo(() => {
    const g: Record<string, Record<string, Product[]>> = {};
    for (const p of filtered) {
      const cat = p.category;
      const sub = p.sub_category || "기타";
      if (!g[cat]) g[cat] = {};
      if (!g[cat][sub]) g[cat][sub] = [];
      g[cat][sub].push(p);
    }
    // 정렬: 커스텀 순서 우선, 없으면 최저가순
    for (const cat of Object.keys(g)) {
      for (const sub of Object.keys(g[cat])) {
        const key = `${cat}::${sub}`;
        const order = customOrder[key];
        if (order) {
          g[cat][sub].sort((a, b) => {
            const ai = order.indexOf(a.id);
            const bi = order.indexOf(b.id);
            if (ai === -1 && bi === -1) return 0;
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          });
        } else {
          g[cat][sub].sort((a, b) => {
            const ap = stats[a.id]?.minPrice ?? Infinity;
            const bp = stats[b.id]?.minPrice ?? Infinity;
            return ap - bp;
          });
        }
      }
    }
    return g;
  }, [filtered, stats, customOrder]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    const keys = new Set<string>();
    for (const cat of Object.keys(grouped)) {
      for (const sub of Object.keys(grouped[cat])) {
        keys.add(`${cat}::${sub}`);
      }
    }
    setExpandedGroups(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, search]);

  const handleSave = async (
    data: Omit<Product, "id" | "created_at" | "updated_at">
  ) => {
    if (editing) {
      const result = await updateProduct(editing.id, data);
      return { error: result.error, data: { ...editing, ...data } as Product };
    } else {
      const result = await addProduct(data);
      return result;
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (e: DragEndEvent, groupKey: string) => {
    if (!e.over || e.active.id === e.over.id) return;
    const [cat, sub] = groupKey.split("::");
    const list = grouped[cat][sub];
    const oldIdx = list.findIndex((p) => p.id === e.active.id);
    const newIdx = list.findIndex((p) => p.id === e.over!.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(list, oldIdx, newIdx);
    setCustomOrder((prev) => ({
      ...prev,
      [groupKey]: reordered.map((p) => p.id),
    }));
  };

  const [prodMenuOpen, setProdMenuOpen] = useState(false);
  const prodMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!prodMenuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (prodMenuRef.current && !prodMenuRef.current.contains(e.target as Node)) setProdMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [prodMenuOpen]);

  return (
    <>
      <PageHeader
        title="쇼핑기록"
        actions={
          <div className="relative" ref={prodMenuRef}>
            <button
              type="button"
              onClick={() => setProdMenuOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
              aria-label="메뉴"
            >
              <Menu className="h-[22px] w-[22px]" strokeWidth={1.6} />
            </button>
            {prodMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border bg-popover p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => { setProdMenuOpen(false); router.push("/finance"); }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent/50"
                  >
                    <Wallet className="h-4 w-4" /> 가계부
                  </button>
                  <button
                    type="button"
                    onClick={() => setProdMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm bg-accent font-medium"
                  >
                    <ShoppingBag className="h-4 w-4" /> 쇼핑기록
                  </button>
                </div>
            )}
          </div>
        }
      />
    <div className="flex flex-col h-[calc(100%-3.5rem)]">
    <div className="flex-1 overflow-y-auto p-4 md:p-6">

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0 md:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제품명/브랜드/소분류 검색"
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Button
            size="sm"
            className={`${PAGE_ACTION_BUTTON} shrink-0`}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            추가
          </Button>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {/* 순서: 전체 → + 추가 → 나머지 분류 */}
          {(["전체", "__add__", ...midCategories.filter((c) => c !== "전체")] as string[]).map((c) => {
            if (c === "__add__") {
              return (
                <button
                  key="__add__"
                  type="button"
                  onClick={() => setAddCategoryOpen(true)}
                  className="shrink-0 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              );
            }
            const active = categoryFilter === c;
            const color = c === "전체" ? "#6B7280" : CATEGORY_COLORS[c] || "#6B7280";
            const canDelete = c !== "전체" && !BUILTIN_CATEGORIES.has(c);
            return (
              <div
                key={c}
                role="button"
                tabIndex={0}
                onClick={() => setCategoryFilter(c)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setCategoryFilter(c);
                  }
                }}
                className={`group/cat inline-flex shrink-0 items-center gap-1 rounded-full border py-1.5 text-xs transition-all cursor-pointer select-none ${
                  canDelete ? "pl-3 pr-1.5" : "px-3"
                }`}
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
                <span>{c}</span>
                {canDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteCategory(c);
                    }}
                    className="flex h-4 w-4 items-center justify-center rounded-full opacity-60 hover:opacity-100 hover:bg-black/10"
                    aria-label={`${c} 삭제`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
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
                        className="w-full flex items-center gap-1.5 px-2.5 py-2 hover:bg-accent/50 transition-colors"
                      >
                        {expanded ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="text-xs font-semibold">{sub}</span>
                      </button>
                      {expanded && (
                        <div className="border-t overflow-x-auto">
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(e) => handleDragEnd(e, groupKey)}
                          >
                            <table className="w-full text-xs" style={{ tableLayout: "auto" }}>
                              <colgroup>
                                <col style={{ width: "1.5rem" }} />
                                <col style={{ width: "2.5rem" }} />
                                <col />
                                <col className="hidden sm:table-column" />
                                <col style={{ width: "1%" }} />
                              </colgroup>
                              <SortableContext
                                items={list.map((p) => p.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                <tbody>
                                  {list.map((p, idx) => (
                                    <ProductRow
                                      key={p.id}
                                      p={p}
                                      idx={idx}
                                      stat={stats[p.id]}
                                      onEdit={(prod) => {
                                        setEditing(prod);
                                        setFormOpen(true);
                                      }}
                                    />
                                  ))}
                                </tbody>
                              </SortableContext>
                            </table>
                          </DndContext>
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
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setStatsTick((t) => t + 1);
        }}
        product={editing}
        onSave={handleSave}
        onDelete={async (id) => {
          const res = await deleteProduct(id);
          return { error: res?.error ?? null };
        }}
      />

      <PromptDialog
        open={addCategoryOpen}
        onOpenChange={setAddCategoryOpen}
        title="새 분류 추가"
        placeholder="예: 비타민"
        confirmLabel="추가"
        onConfirm={async (name) => {
          await addCategory(name);
          setCategoryFilter(name);
        }}
      />

      <ConfirmDialog
        open={!!pendingDeleteCategory}
        onOpenChange={(o) => { if (!o) setPendingDeleteCategory(null); }}
        title="분류 삭제"
        description={`"${pendingDeleteCategory}" 분류를 삭제할까요?`}
        confirmLabel="삭제"
        destructive
        onConfirm={async () => {
          const name = pendingDeleteCategory;
          if (!name) return;
          if (categoryFilter === name) setCategoryFilter("전체");
          await deleteMidCategory(name);
          setPendingDeleteCategory(null);
        }}
      />
    </div>
    </div>
    </>
  );
}

"use client";

import { Suspense, memo, useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Crown,
  ChevronDown,
  ChevronRight,
  Wallet,
  ShoppingBag,
  Menu,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/ui/search-input";
import RowActionPopover from "@/components/ui/row-action-popover";
import { useUrlStringParam } from "@/hooks/use-url-param";
import { toast } from "sonner";
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

interface ProductStat {
  minPrice: number | null;
}

// 큰 리스트 항목 — props 안 변하면 리렌더 스킵 (memo).
const ProductRow = memo(function ProductRow({
  p,
  idx,
  stat,
  onEdit,
  onDelete,
}: {
  p: Product;
  idx: number;
  stat?: ProductStat;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
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
      className="border-t hover:bg-accent/50 cursor-pointer group"
      onClick={() => onEdit(p)}
    >
      <td className="text-center px-1 py-2 whitespace-nowrap w-8" onClick={(e) => e.stopPropagation()}>
        <RowActionPopover
          triggerLabel="제품 메뉴"
          triggerClassName="inline-flex items-center justify-center"
          dragAttributes={attributes as unknown as React.HTMLAttributes<HTMLElement>}
          dragListeners={listeners as unknown as React.HTMLAttributes<HTMLElement>}
          items={[
            {
              icon: <Trash2 className="h-3.5 w-3.5" />,
              label: "삭제",
              destructive: true,
              onClick: () => onDelete(p),
            },
          ]}
        />
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
          {p.is_active && (
            <Wallet
              className="h-3 w-3 text-amber-500 shrink-0"
              aria-label="고정비 등록됨"
            />
          )}
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
});

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsPageInner />
    </Suspense>
  );
}

function ProductsPageInner() {
  const {
    products,
    loading,
    addProduct,
    updateProduct,
    deleteProduct,
    batchUpdateSortOrder,
  } = useProducts();
  const {
    categories: midCategories,
    tags: categoryTags,
    customCategories,
    addCategory,
    deleteCategory: deleteMidCategory,
  } = useProductCategories();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  // 목록 드래그바 탭 → 삭제 메뉴 → 확인 다이얼로그 대상
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [statsTick, setStatsTick] = useState(0);
  const [search, setSearch] = useState("");
  const router = useRouter();
  // category 필터 — URL 동기화 (useUrlStringParam 헬퍼로 통일).
  const [categoryFilter, setCategoryFilter] = useUrlStringParam("category", "전체");
  const [stats, setStats] = useState<Record<string, ProductStat>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<string | null>(null);

  // 카테고리 색상 — DB 의 product_categories.color 가 단일 source of truth.
  // (이전엔 페이지 안에 하드코딩 맵이 있어 사용자가 색을 바꿔도 칩/섹션 헤더가 안 따라갔음.)
  const categoryColors = useMemo(
    () => Object.fromEntries(categoryTags.map((t) => [t.name, t.color])) as Record<string, string>,
    [categoryTags],
  );
  const customCategorySet = useMemo(() => new Set(customCategories), [customCategories]);

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
    // 정렬: sort_order 오름차순 (사용자 드래그 결과). 동률이면 최저가 오름차순.
    for (const cat of Object.keys(g)) {
      for (const sub of Object.keys(g[cat])) {
        g[cat][sub].sort((a, b) => {
          const ao = a.sort_order ?? 0;
          const bo = b.sort_order ?? 0;
          if (ao !== bo) return ao - bo;
          const ap = stats[a.id]?.minPrice ?? Infinity;
          const bp = stats[b.id]?.minPrice ?? Infinity;
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

  // 그룹 펼침 정책:
  //  - 첫 로드 시 모든 그룹 펼침 (사용자가 검색 안 하고 둘러볼 때 기본 노출)
  //  - 검색어 변경 시 매칭 그룹 모두 펼침 (결과 강조)
  //  - 카테고리 필터 변경은 기존 펼침 상태 보존 — 사용자가 닫아둔 그룹 유지.
  const expansionInitialized = useRef(false);
  useEffect(() => {
    if (expansionInitialized.current) return;
    if (Object.keys(grouped).length === 0) return;
    const keys = new Set<string>();
    for (const cat of Object.keys(grouped)) {
      for (const sub of Object.keys(grouped[cat])) keys.add(`${cat}::${sub}`);
    }
    setExpandedGroups(keys);
    expansionInitialized.current = true;
  }, [grouped]);
  useEffect(() => {
    if (!expansionInitialized.current) return;
    const keys = new Set<string>();
    for (const cat of Object.keys(grouped)) {
      for (const sub of Object.keys(grouped[cat])) keys.add(`${cat}::${sub}`);
    }
    setExpandedGroups(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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

  const handleDragEnd = async (e: DragEndEvent, groupKey: string) => {
    if (!e.over || e.active.id === e.over.id) return;
    const [cat, sub] = groupKey.split("::");
    const list = grouped[cat][sub];
    const oldIdx = list.findIndex((p) => p.id === e.active.id);
    const newIdx = list.findIndex((p) => p.id === e.over!.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(list, oldIdx, newIdx);
    // sort_order 0..n 으로 DB 영속화. fetchProducts() 호출되며 재정렬 반영.
    await batchUpdateSortOrder(reordered.map((p) => p.id));
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
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="제품명/브랜드/소분류 검색"
            size="md"
            className="md:max-w-sm"
          />
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
          {/* 순서: 전체 → 빌트인 분류 → 사용자 추가 분류 → +추가 (표준 패턴: 추가 액션은 끝) */}
          {(["전체", ...midCategories.filter((c) => c !== "전체"), "__add__"] as string[]).map((c) => {
            if (c === "__add__") {
              return (
                <button
                  key="__add__"
                  type="button"
                  onClick={() => setAddCategoryOpen(true)}
                  className="shrink-0 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                  aria-label="분류 추가"
                >
                  <Plus className="h-3 w-3" />
                </button>
              );
            }
            const active = categoryFilter === c;
            const color = c === "전체" ? "#6B7280" : categoryColors[c] || "#6B7280";
            const canDelete = c !== "전체" && customCategorySet.has(c);
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
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            {products.length === 0
              ? "등록된 제품이 없습니다"
              : "검색 결과가 없습니다"}
          </p>
          {products.length === 0 && (
            <p className="text-xs text-muted-foreground/70">
              + 버튼으로 제품을 추가하고 구매 가격을 기록해보세요
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.keys(grouped).map((cat) => {
            const catColor = categoryColors[cat] || "#6B7280";
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
                              <thead className="bg-muted/40 text-[10px] font-medium text-muted-foreground">
                                <tr>
                                  <th className="px-1 py-1 text-center" aria-hidden></th>
                                  <th className="px-1 py-1 text-center">순위</th>
                                  <th className="px-2 py-1 text-left">제품</th>
                                  <th className="hidden sm:table-cell px-2 py-1 text-left">브랜드</th>
                                  <th className="px-2 py-1 text-right whitespace-nowrap">최저가</th>
                                </tr>
                              </thead>
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
                                      onDelete={(prod) => setDeletingProduct(prod)}
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
      />

      {/* 제품 삭제 확인 — 목록 드래그바 → 삭제 경로 */}
      <ConfirmDialog
        open={!!deletingProduct}
        onOpenChange={(o) => { if (!o) setDeletingProduct(null); }}
        title={deletingProduct ? `${deletingProduct.name} 삭제` : "제품 삭제"}
        description={
          deletingProduct ? (
            <span className="block">
              <span className="block text-foreground">
                {deletingProduct.category}
                {deletingProduct.sub_category ? ` · ${deletingProduct.sub_category}` : ""}
                {deletingProduct.brand ? ` · ${deletingProduct.brand}` : ""}
              </span>
              <span className="block mt-1.5 text-xs text-muted-foreground/70 break-keep">
                구매 기록도 함께 삭제돼요. 되돌릴 수 없어요.
              </span>
            </span>
          ) : (
            "삭제하면 되돌릴 수 없어요."
          )
        }
        confirmLabel="삭제"
        destructive
        onConfirm={async () => {
          if (deletingProduct) {
            const res = await deleteProduct(deletingProduct.id);
            if (res?.error) {
              const msg =
                typeof res.error === "object" && res.error && "message" in res.error
                  ? String((res.error as { message?: unknown }).message)
                  : "삭제 실패";
              toast.error(msg);
            } else {
              setStatsTick((t) => t + 1);
            }
          }
          setDeletingProduct(null);
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
        title={pendingDeleteCategory ? `${pendingDeleteCategory} 분류 삭제` : "분류 삭제"}
        description="이 분류에 속한 제품은 분류 없음으로 이동합니다."
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

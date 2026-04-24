"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Crown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

interface PriceRow {
  id: string;
  price: number;
  site_url: string | null;
}

export default function ProductDetailDialog({
  open,
  onOpenChange,
  product,
}: Props) {
  const [prices, setPrices] = useState<PriceRow[]>([]);

  useEffect(() => {
    if (!open || !product) {
      setPrices([]);
      return;
    }
    supabase
      .from("product_purchases")
      .select("id, total_price, link")
      .eq("product_id", product.id)
      .order("total_price")
      .then(({ data }) => {
        if (data) {
          setPrices(
            (data as { id: string; total_price: number; link: string | null }[]).map(
              (p) => ({
                id: p.id,
                price: p.total_price,
                site_url: p.link,
              })
            )
          );
        }
      });
  }, [open, product]);

  if (!product) return null;

  const minPrice = prices.length ? Math.min(...prices.map((p) => p.price)) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-6">
            <Badge variant="outline">{product.category}</Badge>
            {product.sub_category && (
              <Badge variant="secondary">{product.sub_category}</Badge>
            )}
            {product.is_active && (
              <span className="text-xs text-green-600 border border-green-300 bg-green-50 rounded px-1.5 py-0.5">
                🏷 고정비
              </span>
            )}
          </div>
          <DialogTitle className="text-lg">{product.name}</DialogTitle>
          {product.brand && (
            <p className="text-xs text-muted-foreground">{product.brand}</p>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {product.notes && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              {product.notes}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold text-muted-foreground">
              가격 비교 ({prices.length}곳)
            </h3>
            {prices.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                등록된 가격이 없습니다
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-right px-3 py-2 font-medium w-32">
                        가격
                      </th>
                      <th className="text-left px-3 py-2 font-medium">사이트</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((p) => {
                      const isMin = p.price === minPrice;
                      return (
                        <tr key={p.id} className="border-t hover:bg-accent/50">
                          <td
                            className={`px-3 py-2 text-right font-medium whitespace-nowrap ${
                              isMin ? "text-green-600" : ""
                            }`}
                          >
                            {isMin && (
                              <Crown className="inline h-3 w-3 mr-1" />
                            )}
                            ₩{p.price.toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            {p.site_url ? (
                              <a
                                href={p.site_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-1 break-all line-clamp-1"
                              >
                                {p.site_url}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
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

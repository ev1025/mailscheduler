"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Supplement } from "@/types";

interface SupplementTableProps {
  supplements: Supplement[];
  onEdit: (supplement: Supplement) => void;
  onDelete: (id: string) => void;
}

function formatPrice(price: number | null) {
  if (price == null) return "-";
  return new Intl.NumberFormat("ko-KR").format(price) + "원";
}

export default function SupplementTable({
  supplements,
  onEdit,
  onDelete,
}: SupplementTableProps) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">순위</TableHead>
            <TableHead>이름</TableHead>
            <TableHead>종류</TableHead>
            <TableHead className="text-right">가격</TableHead>
            <TableHead>링크</TableHead>
            <TableHead>메모</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {supplements.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">
                {s.ranking != null ? (
                  <Badge variant="outline">{s.ranking}</Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>
                {s.type ? (
                  <Badge variant="secondary">{s.type}</Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="text-right">{formatPrice(s.price)}</TableCell>
              <TableCell>
                {s.link ? (
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    링크
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                {s.notes || "-"}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => onEdit(s)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(s.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

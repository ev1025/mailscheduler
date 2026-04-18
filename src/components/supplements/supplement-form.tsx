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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Supplement } from "@/types";

interface SupplementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplement?: Supplement | null;
  onSave: (data: {
    name: string;
    type: string | null;
    price: number | null;
    ranking: number | null;
    link: string | null;
    notes: string | null;
  }) => Promise<{ error: unknown }>;
}

export default function SupplementForm({
  open,
  onOpenChange,
  supplement,
  onSave,
}: SupplementFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [price, setPrice] = useState("");
  const [ranking, setRanking] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (supplement) {
      setName(supplement.name);
      setType(supplement.type || "");
      setPrice(supplement.price != null ? String(supplement.price) : "");
      setRanking(supplement.ranking != null ? String(supplement.ranking) : "");
      setLink(supplement.link || "");
      setNotes(supplement.notes || "");
    } else {
      setName("");
      setType("");
      setPrice("");
      setRanking("");
      setLink("");
      setNotes("");
    }
  }, [supplement, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    const { error } = await onSave({
      name: name.trim(),
      type: type.trim() || null,
      price: price ? parseInt(price, 10) : null,
      ranking: ranking ? parseInt(ranking, 10) : null,
      link: link.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (!error) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {supplement ? "영양제 수정" : "영양제 추가"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">이름 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 * (예: 솔가 비타민D3)"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">종류</Label>
              <Input
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="예: 비타민D"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ranking">순위</Label>
              <Input
                id="ranking"
                type="number"
                min="1"
                value={ranking}
                onChange={(e) => setRanking(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="price">가격 (원)</Label>
            <Input
              id="price"
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="15000"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="link">구매 링크</Label>
            <Input
              id="link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">메모</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="추가 메모"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect } from "react";
import FormPage from "@/components/ui/form-page";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FORM_LABEL,
  FORM_INPUT_PRIMARY,
  FORM_TEXTAREA,
} from "@/lib/form-classes";
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

  const handleSubmit = async () => {
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
    <FormPage
      open={open}
      onOpenChange={onOpenChange}
      title={supplement ? "영양제 수정" : "영양제 추가"}
      submitDisabled={!name.trim()}
      saving={saving}
      onSubmit={handleSubmit}
    >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" className={FORM_LABEL}>이름</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 * (예: 솔가 비타민D3)"
              className={FORM_INPUT_PRIMARY}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5 min-w-0">
              <Label htmlFor="type" className={FORM_LABEL}>종류</Label>
              <Input
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="예: 비타민D"
                className={FORM_INPUT_PRIMARY}
              />
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <Label htmlFor="ranking" className={FORM_LABEL}>순위</Label>
              <Input
                id="ranking"
                type="number"
                min="1"
                value={ranking}
                onChange={(e) => setRanking(e.target.value)}
                placeholder="1"
                className={FORM_INPUT_PRIMARY}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price" className={FORM_LABEL}>가격 (원)</Label>
            <Input
              id="price"
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="15000"
              className={FORM_INPUT_PRIMARY}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link" className={FORM_LABEL}>구매 링크</Label>
            <Input
              id="link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className={FORM_INPUT_PRIMARY}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes" className={FORM_LABEL}>메모</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="추가 메모"
              rows={3}
              className={FORM_TEXTAREA}
            />
          </div>
        </div>
    </FormPage>
  );
}

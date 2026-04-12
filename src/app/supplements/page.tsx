"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupplements } from "@/hooks/use-supplements";
import SupplementTable from "@/components/supplements/supplement-table";
import SupplementForm from "@/components/supplements/supplement-form";
import type { Supplement } from "@/types";
import { toast } from "sonner";

export default function SupplementsPage() {
  const {
    supplements,
    loading,
    addSupplement,
    updateSupplement,
    deleteSupplement,
  } = useSupplements();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplement | null>(null);

  const handleSave = async (data: {
    name: string;
    type: string | null;
    price: number | null;
    ranking: number | null;
    link: string | null;
    notes: string | null;
  }) => {
    if (editing) {
      const result = await updateSupplement(editing.id, data);
      if (!result.error) toast.success("영양제가 수정되었습니다");
      return result;
    } else {
      const result = await addSupplement(data);
      if (!result.error) toast.success("영양제가 추가되었습니다");
      return result;
    }
  };

  const handleEdit = (supplement: Supplement) => {
    setEditing(supplement);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteSupplement(id);
    if (!error) toast.success("영양제가 삭제되었습니다");
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">영양제 비교</h2>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          추가
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : supplements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg text-muted-foreground">
            등록된 영양제가 없습니다
          </p>
          <p className="text-sm text-muted-foreground/60">
            위의 &quot;추가&quot; 버튼으로 영양제를 등록해보세요
          </p>
        </div>
      ) : (
        <SupplementTable
          supplements={supplements}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <SupplementForm
        open={formOpen}
        onOpenChange={setFormOpen}
        supplement={editing}
        onSave={handleSave}
      />
    </div>
  );
}

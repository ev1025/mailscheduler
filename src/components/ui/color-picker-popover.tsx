"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ColorPickerPanel from "@/components/ui/color-picker";

const PRESET_COLORS = [
  "#3B82F6", "#EF4444", "#22C55E", "#F59E0B",
  "#A855F7", "#EC4899", "#06B6D4", "#6B7280",
];

interface Props {
  color: string;
  onChange: (color: string) => void;
}

export default function ColorPickerRow({ color, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(color);
  const isCustom = !PRESET_COLORS.includes(color);

  return (
    <div className="flex items-center gap-1.5">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`h-5 w-5 rounded-full transition-all ${
            color === c ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-110"
          }`}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setPreview(color); }}>
        <PopoverTrigger
          className={`h-5 w-5 rounded-full cursor-pointer transition-all ${
            isCustom || open ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-110"
          }`}
          style={{ background: open ? preview : isCustom ? color : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
        />
        <PopoverContent className="w-[220px] p-3" align="start" side="bottom">
          <ColorPickerPanel
            color={color}
            onPreview={setPreview}
            onConfirm={(c) => { onChange(c); setOpen(false); }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

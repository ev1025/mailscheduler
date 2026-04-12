"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// HSV → RGB → HEX
function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// HEX → HSV
function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hueToColor(h: number): string {
  return hsvToHex(h, 1, 1);
}

interface ColorPickerPanelProps {
  color: string;
  onPreview?: (color: string) => void;
  onConfirm: (color: string) => void;
}

export default function ColorPickerPanel({ color, onPreview, onConfirm }: ColorPickerPanelProps) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => {
    try { return hexToHsv(color); } catch { return [210, 0.7, 0.9]; }
  });
  const [hexInput, setHexInput] = useState(color);

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"sv" | "hue" | null>(null);

  const currentHex = hsvToHex(hsv[0], hsv[1], hsv[2]);

  useEffect(() => {
    setHexInput(currentHex);
    onPreview?.(currentHex);
  }, [currentHex, onPreview]);

  // SV 패널 드래그
  const handleSV = useCallback((clientX: number, clientY: number) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    setHsv([hsv[0], s, v]);
  }, [hsv]);

  // Hue 슬라이더 드래그
  const handleHue = useCallback((clientX: number) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, (clientX - rect.left) / rect.width * 360));
    setHsv([h, hsv[1], hsv[2]]);
  }, [hsv]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current === "sv") handleSV(e.clientX, e.clientY);
      else if (dragging.current === "hue") handleHue(e.clientX);
    };
    const onUp = () => { dragging.current = null; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [handleSV, handleHue]);

  const handleHexChange = (v: string) => {
    setHexInput(v);
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
      setHsv(hexToHsv(v));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* SV 패널 */}
      <div
        ref={svRef}
        className="relative h-36 rounded-md cursor-crosshair overflow-hidden"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueToColor(hsv[0])})`,
        }}
        onMouseDown={(e) => {
          dragging.current = "sv";
          handleSV(e.clientX, e.clientY);
        }}
      >
        {/* 선택 원 */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${hsv[1] * 100}%`,
            top: `${(1 - hsv[2]) * 100}%`,
            backgroundColor: currentHex,
          }}
        />
      </div>

      {/* Hue 슬라이더 */}
      <div
        ref={hueRef}
        className="relative h-3 rounded-full cursor-pointer"
        style={{
          background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
        onMouseDown={(e) => {
          dragging.current = "hue";
          handleHue(e.clientX);
        }}
      >
        <div
          className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${(hsv[0] / 360) * 100}%`,
            backgroundColor: hueToColor(hsv[0]),
          }}
        />
      </div>

      {/* HEX 입력 */}
      <Input
        value={hexInput}
        onChange={(e) => handleHexChange(e.target.value)}
        className="h-8 text-sm font-mono"
        placeholder="#3B82F6"
      />

      {/* 색상 추가 버튼 */}
      <Button
        type="button"
        size="sm"
        className="w-full"
        onClick={() => onConfirm(currentHex)}
      >
        색상 추가
      </Button>
    </div>
  );
}

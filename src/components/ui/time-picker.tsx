"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * 시간 입력 — 24시간제 "HH:MM" 형식.
 *
 * UX:
 *  - 사용자가 숫자 입력 → 2자리 시간 입력되면 자동으로 ":" 삽입 + 커서가 분 영역으로 이동.
 *  - HH 0–23, MM 0–59 범위 자동 클램프.
 *  - 4자리 입력 완료 시 onChange 호출. 부분 입력 중에는 로컬 state 만 변경.
 *  - 비우면 onChange("") 호출.
 *
 * 이전 버전은 휠 형태 popover 였음. 모바일에서 한 손 입력 어려움 + 데스크탑에서도 클릭 횟수 많음.
 * 입력형식이 빠르고 키보드 친화적.
 */
interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** "1729" → "17:29",  "172" → "17:2",  "17" → "17",  "1" → "1" */
function formatTime(digits: string): string {
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ":" + digits.slice(2, 4);
}

/** HH(0–23)/MM(0–59) 클램프. 불완전 입력은 그대로 통과. */
function clampDigits(raw: string): string {
  const d = digitsOnly(raw).slice(0, 4);
  if (d.length < 2) return d;
  let hh = parseInt(d.slice(0, 2));
  if (hh > 23) hh = 23;
  let out = String(hh).padStart(2, "0");
  if (d.length === 2) return out;
  let mm = parseInt(d.slice(2));
  if (d.length === 4 && mm > 59) mm = 59;
  out += d.length === 3 ? d.slice(2, 3) : String(mm).padStart(2, "0");
  return out;
}

export default function TimePicker({ value, onChange, className, placeholder = "HH:MM" }: TimePickerProps) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // 부모로부터 value 가 바뀌면 동기화 (예: 폼 reset).
  useEffect(() => {
    setText(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const clamped = clampDigits(raw);
    const formatted = formatTime(clamped);
    setText(formatted);

    // 커서 위치: 숫자 입력 직후 자동 ":" 삽입 시 분 영역으로 이동시키기 위해 항상 끝으로.
    // 사용자가 중간 클릭 후 입력하는 케이스는 흔치 않아 단순 처리.
    requestAnimationFrame(() => {
      if (inputRef.current && document.activeElement === inputRef.current) {
        const len = formatted.length;
        inputRef.current.setSelectionRange(len, len);
      }
    });

    if (clamped.length === 4) {
      onChange(formatted);
    } else if (clamped.length === 0) {
      onChange("");
    }
    // 부분 입력 (1~3자리) 시에는 부모에 안 알림 — 저장 시점에서 4자리만 유효로 인정.
  };

  const handleBlur = () => {
    // blur 시 4자리 미만이면 빈 값 처리 (저장 시 혼란 방지).
    const d = digitsOnly(text);
    if (d.length === 0) {
      if (value !== "") onChange("");
      return;
    }
    if (d.length < 4) {
      // 미완성 입력은 0 패딩으로 자동 완성. 예: "9" → "09:00", "09:3" → "09:30".
      const hh = String(parseInt(d.slice(0, 2) || d) || 0).padStart(2, "0");
      const mm = (d.slice(2) || "00").padEnd(2, "0").slice(0, 2);
      const completed = `${hh.slice(0, 2)}:${mm}`;
      setText(completed);
      onChange(completed);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      maxLength={5}
      className={cn(
        "rounded-md border bg-background px-2.5 text-sm tabular-nums transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring",
        !text && "text-muted-foreground",
        className,
      )}
      aria-label="시간"
    />
  );
}

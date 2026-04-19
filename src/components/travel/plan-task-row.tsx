"use client";

import { useState, useEffect } from "react";
import { X, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import PlanPlacePicker from "@/components/travel/plan-place-picker";
import type { TravelPlanTask, PlaceInfo } from "@/types";

// 계획 일정 한 행 — 시간 / 장소 / 태그 / 내용 / 체류시간(분)
// 장소가 비어있으면 PlanPlacePicker 로 검색 → 선택 시 place_* 4필드 자동 채움.
// 나머지 필드는 인라인 편집(400ms debounce 로 상위에서 저장).

interface Props {
  task: TravelPlanTask;
  onChange: (updates: Partial<TravelPlanTask>) => void;
  onDelete: () => void;
}

export default function PlanTaskRow({ task, onChange, onDelete }: Props) {
  const [placeQuery, setPlaceQuery] = useState("");
  const [localTime, setLocalTime] = useState(task.start_time ?? "");
  const [localContent, setLocalContent] = useState(task.content ?? "");
  const [localStay, setLocalStay] = useState(String(task.stay_minutes || ""));
  const [localTag, setLocalTag] = useState(task.tag ?? "");

  // 서버 값 변경 시 로컬 동기화 (다른 클라이언트 편집 대비)
  useEffect(() => { setLocalTime(task.start_time ?? ""); }, [task.start_time]);
  useEffect(() => { setLocalContent(task.content ?? ""); }, [task.content]);
  useEffect(() => { setLocalStay(String(task.stay_minutes || "")); }, [task.stay_minutes]);
  useEffect(() => { setLocalTag(task.tag ?? ""); }, [task.tag]);

  // 400ms debounce 저장 helper
  const debouncedSave = (key: keyof TravelPlanTask, value: string | number | null) => {
    const timer = setTimeout(() => onChange({ [key]: value } as Partial<TravelPlanTask>), 400);
    return () => clearTimeout(timer);
  };

  useEffect(() => {
    if (localTime === (task.start_time ?? "")) return;
    return debouncedSave("start_time", localTime || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTime]);
  useEffect(() => {
    if (localContent === (task.content ?? "")) return;
    return debouncedSave("content", localContent || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localContent]);
  useEffect(() => {
    const n = parseInt(localStay, 10);
    const nextVal = Number.isFinite(n) && n > 0 ? n : 0;
    if (nextVal === task.stay_minutes) return;
    return debouncedSave("stay_minutes", nextVal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStay]);
  useEffect(() => {
    if (localTag === (task.tag ?? "")) return;
    return debouncedSave("tag", localTag || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTag]);

  const handlePickPlace = (p: PlaceInfo) => {
    onChange({
      place_name: p.name,
      place_address: p.address,
      place_lat: p.lat,
      place_lng: p.lng,
    });
  };

  const placeChosen = !!task.place_name;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* 1행: 시간 · 체류 · 삭제 */}
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={localTime}
              onChange={(e) => setLocalTime(e.target.value)}
              className="h-8 w-24 text-xs"
              placeholder="시간"
            />
            <Input
              type="number"
              min={0}
              value={localStay}
              onChange={(e) => setLocalStay(e.target.value)}
              className="h-8 w-20 text-xs"
              placeholder="분"
            />
            <span className="text-xs text-muted-foreground">체류</span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
              aria-label="행 삭제"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* 2행: 장소 (검색 or 선택됨 표시) */}
          {placeChosen ? (
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
              <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{task.place_name}</div>
                {task.place_address && (
                  <div className="text-xs text-muted-foreground truncate">{task.place_address}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    place_name: "",
                    place_address: null,
                    place_lat: null,
                    place_lng: null,
                  })
                }
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                변경
              </button>
            </div>
          ) : (
            <PlanPlacePicker
              value={placeQuery}
              onChange={setPlaceQuery}
              onPick={handlePickPlace}
              placeholder="장소명·지역 (예: 성산일출봉)"
            />
          )}

          {/* 3행: 태그 · 내용 */}
          <div className="flex items-center gap-2">
            <Input
              value={localTag}
              onChange={(e) => setLocalTag(e.target.value)}
              placeholder="태그"
              className="h-8 w-28 text-xs"
            />
            <Input
              value={localContent}
              onChange={(e) => setLocalContent(e.target.value)}
              placeholder="내용 (예: 일출 보기)"
              className="h-8 flex-1 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

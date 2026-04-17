"use client";

import { useState, useCallback, useRef } from "react";
import { Search, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import WeatherIcon from "./weather-icon";
import type { CalendarEvent, EventTag, WeatherData } from "@/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface DatabaseViewProps {
  events: CalendarEvent[];
  weatherMap: Record<string, WeatherData>;
  tags: EventTag[];
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
}

type SortField = "date" | "title" | "tag";
type SortDir = "asc" | "desc";

function parseDay(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return {
    month: d.getMonth() + 1,
    day: d.getDate(),
    weekday: format(d, "EEE", { locale: ko }),
    dow: d.getDay(),
  };
}

export default function DatabaseView({
  events,
  weatherMap,
  tags: tagList,
  onEdit,
  onDelete,
}: DatabaseViewProps) {
  const tagColorMap: Record<string, string> = {};
  for (const t of tagList) tagColorMap[t.name] = t.color;

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);

  // 초기에는 빈 배열 → CSS auto/1%로 컨텐츠 너비 자동 맞춤
  // 첫 드래그 시 실제 px 너비 측정 → fixed 모드로 전환
  const [colWidths, setColWidths] = useState<number[]>([]);
  const [isResizing, setIsResizing] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const resizingCol = useRef<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);


  const allTags = [...new Set(events.map((e) => e.tag).filter(Boolean).flatMap((t) => t!.split(",")))] as string[];

  // 정렬 3단계: asc → desc → none(정렬 해제)
  const cycleSort = (field: SortField) => {
    if (sortField !== field) { setSortField(field); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortField("date"); setSortDir("asc"); } // 해제 → 기본 날짜순 복귀
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null; // 비활성 열에는 아이콘 없음
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-0.5" /> : <ArrowDown className="h-3 w-3 ml-0.5" />;
  };

  const onResizeStart = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let currentWidths = colWidths;

    // 최초 리사이즈: 현재 렌더링된 실제 너비 측정 → 상태 저장
    if (currentWidths.length === 0 && tableRef.current) {
      const ths = Array.from(tableRef.current.querySelectorAll("thead th"));
      currentWidths = ths.map((th) => th.getBoundingClientRect().width);
      setColWidths(currentWidths);
    }

    resizingCol.current = colIdx;
    resizeStartX.current = e.clientX;
    resizeStartW.current = currentWidths[colIdx];
    setIsResizing(true);

    const onMove = (ev: MouseEvent) => {
      if (resizingCol.current === null) return;
      const diff = ev.clientX - resizeStartX.current;
      setColWidths((prev) => {
        const next = [...prev];
        next[resizingCol.current!] = Math.max(60, resizeStartW.current + diff);
        return next;
      });
    };
    const onUp = () => {
      resizingCol.current = null;
      setIsResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [colWidths]);


  const filtered = events
    .filter((ev) => {
      if (filterTags.length > 0 && (!ev.tag || !filterTags.some((ft) => ev.tag!.split(",").includes(ft)))) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return ev.title.toLowerCase().includes(q) || (ev.description || "").toLowerCase().includes(q) || (ev.tag || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "date") return a.start_date.localeCompare(b.start_date) * dir;
      if (sortField === "title") return a.title.localeCompare(b.title) * dir;
      return (a.tag || "").localeCompare(b.tag || "") * dir;
    });

  const columns = [
    { label: "날짜", field: "date" as SortField },
    { label: "날씨", field: null },
    { label: "제목", field: "title" as SortField },
    { label: "태그", field: "tag" as SortField },
  ];

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* 검색 + 태그 필터 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="검색..." className="pl-8 h-9 text-sm" />
          </div>
          {allTags.length > 0 && (
            <button
              type="button"
              onClick={() => setTagFilterOpen((o) => !o)}
              className={`flex items-center gap-1 shrink-0 rounded-md border px-2.5 h-9 text-xs transition-colors ${
                filterTags.length > 0 ? "border-primary text-primary bg-primary/10" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <Filter className="h-3 w-3" />
              태그{filterTags.length > 0 && ` (${filterTags.length})`}
            </button>
          )}
        </div>
        {/* 태그 필터 패널 */}
        {tagFilterOpen && allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 rounded-md border bg-muted/20 p-2">
            <button
              type="button"
              onClick={() => setFilterTags([])}
              className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                filterTags.length === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              전체
            </button>
            {allTags.map((t) => {
              const active = filterTags.includes(t);
              const c = tagColorMap[t] || "#6B7280";
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterTags((prev) => active ? prev.filter((x) => x !== t) : [...prev, t])}
                  className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors"
                  style={active ? { borderColor: c, backgroundColor: c + "20", color: c, fontWeight: 600 } : {}}
                >
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
                  {t}
                </button>
              );
            })}
          </div>
        )}
        {/* 활성 필터 배지 */}
        {filterTags.length > 0 && !tagFilterOpen && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterTags.map((ft) => {
              const c = tagColorMap[ft] || "#6B7280";
              return (
                <Badge key={ft} className="cursor-pointer shrink-0 text-[10px]" style={{ backgroundColor: c + "20", color: c, borderColor: c + "40" }}
                  onClick={() => setFilterTags((prev) => prev.filter((t) => t !== ft))}>{ft} ✕</Badge>
              );
            })}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">{search || filterTags.length > 0 ? "검색 결과가 없습니다" : "이 달의 일정이 없습니다"}</p>
        </div>
      ) : (
        <div className={`flex-1 min-h-0 overflow-auto ${isResizing ? "select-none cursor-col-resize" : ""}`}>
          <div className="rounded-lg border">
          <table
            ref={tableRef}
            className="w-full border-collapse"
            style={{ tableLayout: colWidths.length > 0 ? "fixed" : "auto" }}
          >
            <colgroup>
              {[0, 1, 2, 3].map((idx) => {
                const isFlexible = idx === 2; // 제목
                const widthStyle = colWidths.length > 0
                  ? (isFlexible ? "auto" : `${colWidths[idx]}px`)
                  : (isFlexible ? "auto" : "1%");
                return <col key={idx} style={{ width: widthStyle }} />;
              })}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-muted/40 text-xs text-muted-foreground">
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={col.label}
                    className="relative text-left font-medium px-3 py-2.5 border-b border-r last:border-r-0 select-none whitespace-nowrap"
                  >
                    {col.field ? (
                      <button className="flex items-center font-medium" onClick={() => cycleSort(col.field!)}>
                        {col.label} <SortIcon field={col.field} />
                      </button>
                    ) : (
                      <span>{col.label}</span>
                    )}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-[6px] -mr-[3px] z-20 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 touch-none"
                      onMouseDown={(e) => onResizeStart(idx, e)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev) => (
                <tr
                  key={ev.id}
                  className="cursor-pointer hover:bg-accent/40 transition-colors border-b last:border-b-0"
                  onClick={() => onEdit(ev)}
                >
                  {/* 날짜 — 4/15(수) ~ 4/17(금), 검정색 */}
                  <td className="px-2 py-2 border-r whitespace-nowrap overflow-hidden">
                    {(() => {
                      const s = parseDay(ev.start_date);
                      const e = ev.end_date && ev.end_date !== ev.start_date ? parseDay(ev.end_date) : null;
                      return (
                        <span className="text-[10px] text-foreground tabular-nums">
                          {s.month}/{s.day}({s.weekday})
                          {e && ` ~ ${e.month}/${e.day}(${e.weekday})`}
                        </span>
                      );
                    })()}
                  </td>
                  {/* 날씨 — 아이콘 위 / 온도 아래 스택 */}
                  <td className="px-1 py-1.5 border-r overflow-hidden min-w-0">
                    {weatherMap[ev.start_date] ? (
                      <WeatherIcon weather={weatherMap[ev.start_date]} compact />
                    ) : (
                      <span className="text-xs text-muted-foreground/40">-</span>
                    )}
                  </td>
                  {/* 제목 */}
                  <td className="px-3 py-2 border-r overflow-hidden min-w-0">
                    <div className="text-xs font-medium truncate">{ev.title}</div>
                  </td>
                  {/* 태그 */}
                  <td className="px-3 py-2.5 overflow-hidden min-w-0">
                    <div className="flex gap-1 overflow-hidden whitespace-nowrap">
                      {ev.tag ? ev.tag.split(",").map((t) => (
                        <Badge key={t} className="text-xs font-normal px-1.5 py-0 shrink-0" style={{ backgroundColor: (tagColorMap[t] || "#6B7280") + "20", color: tagColorMap[t] || "#6B7280", borderColor: (tagColorMap[t] || "#6B7280") + "40" }}>
                          {t}
                        </Badge>
                      )) : <span className="text-xs text-muted-foreground/40">-</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

    </div>
  );
}

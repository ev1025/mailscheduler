"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, ArrowUp, ArrowDown, ArrowUpDown, Filter } from "lucide-react";
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

  // 초기에는 빈 배열 → CSS auto/1%로 컨텐츠 너비 자동 맞춤
  // 첫 드래그 시 실제 px 너비 측정 → fixed 모드로 전환
  const [colWidths, setColWidths] = useState<number[]>([]);
  const [isResizing, setIsResizing] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const resizingCol = useRef<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  // 우클릭 필터 메뉴
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; field: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const allTags = [...new Set(events.map((e) => e.tag).filter(Boolean).flatMap((t) => t!.split(",")))] as string[];

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-0.5 opacity-30" />;
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

  const handleHeaderContext = (e: React.MouseEvent, field: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, field });
  };

  // 외부 클릭 시 컨텍스트 메뉴 닫기 (메뉴 내부 클릭은 무시)
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [contextMenu]);

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
    <div className="flex flex-col gap-3">
      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="검색..." className="pl-8 h-9 text-sm" />
      </div>
      {/* 필터 태그 (모바일에서 오른쪽으로 잘리지 않게 wrap) */}
      {filterTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterTags.map((ft) => {
            const c = tagColorMap[ft] || "#6B7280";
            return (
              <Badge
                key={ft}
                className="cursor-pointer shrink-0"
                style={{ backgroundColor: c + "20", color: c, borderColor: c + "40" }}
                onClick={() => setFilterTags((prev) => prev.filter((t) => t !== ft))}
              >
                {ft} ✕
              </Badge>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">{search || filterTags.length > 0 ? "검색 결과가 없습니다" : "이 달의 일정이 없습니다"}</p>
        </div>
      ) : (
        <div className={`rounded-lg border max-h-[65vh] overflow-auto ${isResizing ? "select-none cursor-col-resize" : ""}`}>
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
                    onContextMenu={(e) => handleHeaderContext(e, col.label)}
                  >
                    {col.field ? (
                      <button className="flex items-center font-medium" onClick={() => toggleSort(col.field!)}>
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
                  {/* 날짜 — 숫자 크게 + 요일 작게 2줄 스택 */}
                  <td className="px-2 py-2 border-r whitespace-nowrap overflow-hidden">
                    {(() => {
                      const s = parseDay(ev.start_date);
                      const e = ev.end_date && ev.end_date !== ev.start_date ? parseDay(ev.end_date) : null;
                      const dowColor = (dow: number) =>
                        dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-muted-foreground";
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                          <div className="flex flex-col leading-tight">
                            <span className="text-sm font-semibold tabular-nums">
                              {s.month}/{s.day}
                              {e && (
                                <span className="text-muted-foreground">~{e.month}/{e.day}</span>
                              )}
                            </span>
                            <span className={`text-[10px] ${dowColor(s.dow)}`}>
                              {s.weekday}
                              {e && ` ~ ${e.weekday}`}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  {/* 날씨 */}
                  <td className="px-2 py-2.5 border-r overflow-hidden min-w-0">
                    {weatherMap[ev.start_date] ? (
                      <WeatherIcon weather={weatherMap[ev.start_date]} inline />
                    ) : (
                      <span className="text-xs text-muted-foreground/40">-</span>
                    )}
                  </td>
                  {/* 제목 */}
                  <td className="px-3 py-2.5 border-r overflow-hidden min-w-0">
                    <div className="text-sm font-medium truncate">{ev.title}</div>
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
      )}

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.field === "태그" && allTags.length > 0 && (
            <>
              <div className="px-3 py-1 text-xs text-muted-foreground font-medium">태그 필터 (복수 선택)</div>
              <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent" onClick={() => { setFilterTags([]); }}>
                전체 보기
              </button>
              <div className="max-h-[180px] overflow-y-auto">
                {allTags.map((t) => {
                  const active = filterTags.includes(t);
                  return (
                    <button key={t} className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2" onClick={() => {
                      setFilterTags((prev) => active ? prev.filter((x) => x !== t) : [...prev, t]);
                    }}>
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tagColorMap[t] || "#6B7280" }} />
                      {t} {active && "✓"}
                    </button>
                  );
                })}
              </div>
              <div className="border-t my-1" />
            </>
          )}
          <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent" onClick={() => { toggleSort(sortField); setContextMenu(null); }}>
            <ArrowUp className="inline h-3 w-3 mr-1.5" />오름차순 정렬
          </button>
          <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent" onClick={() => { setSortDir("desc"); setContextMenu(null); }}>
            <ArrowDown className="inline h-3 w-3 mr-1.5" />내림차순 정렬
          </button>
        </div>
      )}
    </div>
  );
}

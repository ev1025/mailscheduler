"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Search, Trash2, CalendarPlus, Check, ArrowUp, ArrowDown, ArrowUpDown, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TravelForm from "./travel-form";
import TravelToCalendarDialog from "./travel-to-calendar-dialog";
import { useTravelItems } from "@/hooks/use-travel-items";
import { useTravelTags } from "@/hooks/use-travel-tags";
import { useEventTags } from "@/hooks/use-event-tags";
import { toast } from "sonner";
import type { TravelItem, CalendarEvent } from "@/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ORDER_KEY = "travel_list_custom_order";

function loadCustomOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomOrder(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
}

type SortField = "title" | "category" | "region" | "tag" | "month";
type SortDir = "asc" | "desc";

const CATEGORY_COLORS: Record<string, string> = {
  자연: "#22C55E",
  숙소: "#A855F7",
  식당: "#F59E0B",
  놀거리: "#3B82F6",
  기타: "#6B7280",
};

interface TravelRowProps {
  item: TravelItem;
  tagColorMap: Record<string, string>;
  dragEnabled: boolean;
  onEdit: () => void;
  onToggleVisited: () => void;
  onAddToCalendar: () => void;
  onDelete: () => void;
}

function TravelRow({
  item,
  tagColorMap,
  dragEnabled,
  onEdit,
  onToggleVisited,
  onAddToCalendar,
  onDelete,
}: TravelRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !dragEnabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const color = CATEGORY_COLORS[item.category] || "#6B7280";

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-accent/40 transition-colors border-b last:border-b-0 cursor-pointer ${item.visited ? "opacity-50" : ""}`}
      onClick={onEdit}
    >
      {/* 왼쪽 드래그 핸들 + 액션 팝오버 (드래그하면 이동, 탭하면 메뉴) */}
      <td className="px-1 py-2.5 border-r whitespace-nowrap w-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center" {...(dragEnabled ? { ...attributes, ...listeners } : {})}>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger
              className="rounded p-1 text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent cursor-grab active:cursor-grabbing touch-none"
              title="드래그로 이동 / 탭하면 메뉴"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="start" side="right">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                onClick={() => { setMenuOpen(false); onAddToCalendar(); }}
              >
                <CalendarPlus className="h-3.5 w-3.5 text-blue-600" />
                달력에 추가
              </button>
              <button
                type="button"
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent ${item.visited ? "text-green-600" : ""}`}
                onClick={() => { setMenuOpen(false); onToggleVisited(); }}
              >
                <Check className="h-3.5 w-3.5 text-green-600" />
                {item.visited ? "가본 곳 해제" : "가본 곳으로 표시"}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => { setMenuOpen(false); onDelete(); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </td>
      {/* 제목 */}
      <td className="px-3 py-2.5 border-r overflow-hidden">
        <span className="text-sm font-medium truncate block">{item.title}</span>
      </td>
      {/* 분류 */}
      <td className="px-3 py-2.5 border-r whitespace-nowrap">
        <Badge variant="outline" className="text-[10px] h-4 px-1.5" style={{ borderColor: color + "60", color }}>
          {item.category}
        </Badge>
      </td>
      {/* 시기 */}
      <td className="px-3 py-2.5 border-r text-xs text-muted-foreground whitespace-nowrap">
        {item.month ? `${item.month}월` : "-"}
      </td>
      {/* 지역 */}
      <td className="px-3 py-2.5 border-r text-xs text-muted-foreground whitespace-nowrap">
        {item.region || "-"}
      </td>
      {/* 태그 */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex gap-1">
          {item.tag ? item.tag.split(",").map((t) => {
            const tc = tagColorMap[t] || "#6B7280";
            return (
              <Badge key={t} className="text-[10px] font-normal px-1.5 py-0 shrink-0" style={{ backgroundColor: tc + "20", color: tc, borderColor: tc + "40" }}>
                {t}
              </Badge>
            );
          }) : <span className="text-xs text-muted-foreground/40">-</span>}
        </div>
      </td>
    </tr>
  );
}

interface TravelListProps {
  onNavigateToMonth?: (year: number, month: number) => void;
  onAddEvent?: (event: Omit<CalendarEvent, "id" | "created_at">) => Promise<{ error: unknown }>;
  onAddEventTagToCalendar?: (name: string, color: string) => Promise<{ error: unknown }>;
  onDeleteCalendarEventsByTitleDate?: (title: string, date: string) => Promise<void>;
}

export default function TravelList({ onNavigateToMonth, onAddEvent, onAddEventTagToCalendar, onDeleteCalendarEventsByTitleDate }: TravelListProps = {}) {
  const { items, addItem, updateItem, deleteItem, toggleVisited } = useTravelItems();
  const { tags, addTag, deleteTag, updateTagColor } = useTravelTags();
  const { tags: eventTags, addTag: addEventTag, deleteTag: deleteEventTag, updateTagColor: updateEventTagColor, refetch: refetchEventTags } = useEventTags();

  const [search, setSearch] = useState("");
  const [showVisited, setShowVisited] = useState(true);
  const [customOrder, setCustomOrder] = useState<string[]>([]);

  useEffect(() => {
    setCustomOrder(loadCustomOrder());
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TravelItem | null>(null);
  const [calendarItem, setCalendarItem] = useState<TravelItem | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; field: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const tagColorMap: Record<string, string> = {};
  for (const t of tags) tagColorMap[t.name] = t.color;
  for (const t of eventTags) tagColorMap[t.name] = t.color;

  const allCategories = [...new Set(items.map((i) => i.category))];
  const allItemTags = [...new Set(items.flatMap((i) => i.tag ? i.tag.split(",") : []))];

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-0.5 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-0.5" /> : <ArrowDown className="h-3 w-3 ml-0.5" />;
  };

  const handleHeaderContext = (e: React.MouseEvent, field: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, field });
  };

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

  const hasActiveSortOrFilter =
    !!search.trim() ||
    filterCategories.length > 0 ||
    filterTags.length > 0 ||
    sortField !== "title" ||
    sortDir !== "asc";

  const filteredBase = items.filter((item) => {
    if (!showVisited && item.visited) return false;
    if (filterCategories.length > 0 && !filterCategories.includes(item.category)) return false;
    if (filterTags.length > 0 && (!item.tag || !filterTags.some((ft) => item.tag!.split(",").includes(ft)))) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !(item.region || "").toLowerCase().includes(q) && !(item.tag || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filtered = hasActiveSortOrFilter || customOrder.length === 0
    ? [...filteredBase].sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortField === "title") return a.title.localeCompare(b.title) * dir;
        if (sortField === "category") return a.category.localeCompare(b.category) * dir;
        if (sortField === "region") return (a.region || "").localeCompare(b.region || "") * dir;
        if (sortField === "month") return ((a.month ?? 99) - (b.month ?? 99)) * dir;
        return (a.tag || "").localeCompare(b.tag || "") * dir;
      })
    : (() => {
        const orderMap = new Map(customOrder.map((id, i) => [id, i]));
        return [...filteredBase].sort((a, b) => {
          const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
          const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
          if (ai !== bi) return ai - bi;
          return a.title.localeCompare(b.title);
        });
      })();

  const dragEnabled = !hasActiveSortOrFilter;

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = filtered.map((i) => i.id);
    const oldIdx = ids.indexOf(e.active.id as string);
    const newIdx = ids.indexOf(e.over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(ids, oldIdx, newIdx);
    // 전체 customOrder에 반영: filtered에 속하지 않은 id는 유지
    const filteredSet = new Set(ids);
    const preserved = customOrder.filter((id) => !filteredSet.has(id));
    const next = [...reordered, ...preserved];
    // 혹시 이번에 처음 보이는 아이템(customOrder에 없던)도 누락 없게 추가
    for (const id of ids) if (!next.includes(id)) next.push(id);
    setCustomOrder(next);
    saveCustomOrder(next);
  };

  const handleRemoveVisitedDate = async (itemId: string, date: string) => {
    const target = items.find((i) => i.id === itemId);
    if (!target || !target.visited_dates) return;
    const next = target.visited_dates.filter((d) => d !== date);
    await updateItem(itemId, {
      visited_dates: next.length > 0 ? next : null,
      visited: next.length > 0,
    });
    if (onDeleteCalendarEventsByTitleDate) {
      await onDeleteCalendarEventsByTitleDate(target.title, date);
    }
  };

  const handleAddToCalendar = async (date: string, endDate: string | null, startTime: string | null, endTime: string | null) => {
    if (!calendarItem) return;
    if (!onAddEvent) {
      toast.error("캘린더 추가 기능을 사용할 수 없습니다");
      return;
    }
    const meta = [
      calendarItem.month != null ? `🗓️ ${calendarItem.month}월` : null,
      calendarItem.region ? `📍 ${calendarItem.region}` : null,
    ].filter(Boolean).join("  ");
    const desc = [
      calendarItem.notes,
      meta || null,
    ].filter(Boolean).join("\n\n");

    // 여행/일정 태그를 캘린더 색상으로 표시하려면 event_tags에도 등록되어 있어야 함
    const itemTagNames = calendarItem.tag ? calendarItem.tag.split(",") : [];
    const existingEventTagNames = new Set(eventTags.map((t) => t.name));
    const travelTagColorMap: Record<string, string> = {};
    for (const t of tags) travelTagColorMap[t.name] = t.color;
    for (const name of itemTagNames) {
      if (!existingEventTagNames.has(name)) {
        const color = travelTagColorMap[name] || "#6B7280";
        if (onAddEventTagToCalendar) {
          await onAddEventTagToCalendar(name, color);
        } else {
          await addEventTag(name, color);
        }
      }
    }
    await refetchEventTags();

    const { error } = await onAddEvent({
      title: calendarItem.title,
      description: desc || null,
      start_date: date,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      color: calendarItem.color || CATEGORY_COLORS[calendarItem.category] || "#3B82F6",
      tag: calendarItem.tag,
      repeat: null,
    });
    if (error) {
      toast.error("캘린더 추가 실패");
      return;
    }

    const existingDates = calendarItem.visited_dates || [];
    const newDates = existingDates.includes(date) ? existingDates : [...existingDates, date].sort();
    await updateItem(calendarItem.id, { visited: true, visited_dates: newDates });

  };

  const columns = [
    { label: "", field: null },
    { label: "제목", field: "title" as SortField },
    { label: "분류", field: "category" as SortField },
    { label: "시기", field: "month" as SortField },
    { label: "지역", field: "region" as SortField },
    { label: "태그", field: "tag" as SortField },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* 상단: 검색 + 필터 뱃지 + 추가 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-72 shrink-0">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="검색..." className="pl-8 h-8 text-xs" />
        </div>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap shrink-0">
          <input type="checkbox" checked={showVisited} onChange={(e) => setShowVisited(e.target.checked)} className="rounded" />
          가본 곳 포함
        </label>
        {filterCategories.map((c) => (
          <Badge
            key={c}
            className="cursor-pointer shrink-0"
            style={{ backgroundColor: CATEGORY_COLORS[c] + "20", color: CATEGORY_COLORS[c], borderColor: CATEGORY_COLORS[c] + "40" }}
            onClick={() => setFilterCategories((prev) => prev.filter((x) => x !== c))}
          >
            {c} ✕
          </Badge>
        ))}
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
        <div className="flex-1" />
        <Button size="sm" className="h-8" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          추가
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-sm text-muted-foreground">
            {items.length === 0 ? "여행 항목이 없습니다" : "검색 결과가 없습니다"}
          </p>
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground/60">+ 추가 버튼으로 시작하세요</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border max-h-[65vh] overflow-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full border-collapse">
              <colgroup>
                <col style={{ width: "1%" }} />
                <col />
                <col style={{ width: "1%" }} />
                <col style={{ width: "1%" }} />
                <col style={{ width: "1%" }} />
                <col style={{ width: "1%" }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.label || "grip"}
                      className="text-left font-medium px-3 py-2.5 border-b border-r last:border-r-0 select-none whitespace-nowrap"
                      onContextMenu={col.field ? (e) => handleHeaderContext(e, col.label) : undefined}
                    >
                      {col.field ? (
                        <button className="flex items-center font-medium" onClick={() => toggleSort(col.field!)}>
                          {col.label} <SortIcon field={col.field} />
                        </button>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SortableContext items={filtered.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  {filtered.map((item) => (
                    <TravelRow
                      key={item.id}
                      item={item}
                      tagColorMap={tagColorMap}
                      dragEnabled={dragEnabled}
                      onEdit={() => { setEditing(item); setFormOpen(true); }}
                      onToggleVisited={() => toggleVisited(item.id, item.visited)}
                      onAddToCalendar={() => setCalendarItem(item)}
                      onDelete={() => deleteItem(item.id)}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        </div>
      )}

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.field === "분류" && allCategories.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium">분류 필터 (복수)</div>
              <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent" onClick={() => setFilterCategories([])}>
                전체 보기
              </button>
              <div className="max-h-[180px] overflow-y-auto">
                {allCategories.map((c) => {
                  const active = filterCategories.includes(c);
                  return (
                    <button key={c} className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2" onClick={() => {
                      setFilterCategories((prev) => active ? prev.filter((x) => x !== c) : [...prev, c]);
                    }}>
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[c] }} />
                      {c} {active && "✓"}
                    </button>
                  );
                })}
              </div>
              <div className="border-t my-1" />
            </>
          )}
          {contextMenu.field === "태그" && allItemTags.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium">태그 필터 (복수)</div>
              <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent" onClick={() => setFilterTags([])}>
                전체 보기
              </button>
              <div className="max-h-[180px] overflow-y-auto">
                {allItemTags.map((t) => {
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
          <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent" onClick={() => {
            const f = contextMenu.field === "제목" ? "title" : contextMenu.field === "분류" ? "category" : contextMenu.field === "지역" ? "region" : "tag";
            setSortField(f as SortField);
            setSortDir("asc");
            setContextMenu(null);
          }}>
            <ArrowUp className="inline h-3 w-3 mr-1.5" />오름차순
          </button>
          <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent" onClick={() => {
            const f = contextMenu.field === "제목" ? "title" : contextMenu.field === "분류" ? "category" : contextMenu.field === "지역" ? "region" : "tag";
            setSortField(f as SortField);
            setSortDir("desc");
            setContextMenu(null);
          }}>
            <ArrowDown className="inline h-3 w-3 mr-1.5" />내림차순
          </button>
        </div>
      )}

      <TravelForm
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editing ? items.find((i) => i.id === editing.id) ?? editing : null}
        tags={tags}
        eventTags={eventTags}
        onAddTag={addTag}
        onDeleteTag={deleteTag}
        onUpdateTagColor={updateTagColor}
        onAddEventTag={addEventTag}
        onDeleteEventTag={deleteEventTag}
        onUpdateEventTagColor={updateEventTagColor}
        onNavigateToMonth={onNavigateToMonth}
        onRemoveVisitedDate={handleRemoveVisitedDate}
        onSave={async (data) => {
          if (editing) return await updateItem(editing.id, data);
          return await addItem(data);
        }}
      />

      <TravelToCalendarDialog
        open={!!calendarItem}
        onOpenChange={(o) => !o && setCalendarItem(null)}
        item={calendarItem}
        travelTags={tags}
        eventTags={eventTags}
        onAddToCalendar={handleAddToCalendar}
      />
    </div>
  );
}

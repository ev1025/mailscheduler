"use client";

import Link from "next/link";
import { Target, Plane } from "lucide-react";
import { useDdays, formatDdayLabel, type DdayItem } from "@/hooks/use-ddays";

// D-day 위젯 — 사이드바/홈에서 가까운 일정 몇 개 표시.
// 미래 순(가까운 것부터) 최대 `limit` 개.

interface Props {
  limit?: number;
  visibleUserIds?: string[];
  /** 클릭 시 이동 경로 커스터마이즈. 기본: event → /calendar, travel → /calendar?view=travel-plan&planId= */
  buildHref?: (item: DdayItem) => string;
  className?: string;
}

function defaultHref(item: DdayItem): string {
  if (item.kind === "travel") {
    const planId = item.id.replace(/^plan:/, "");
    return `/calendar?view=travel-plan&planId=${planId}`;
  }
  return `/calendar`;
}

export default function DdayWidget({ limit = 5, visibleUserIds, buildHref, className }: Props) {
  const { items, loading } = useDdays(visibleUserIds);
  const href = buildHref ?? defaultHref;

  // 위젯엔 오늘 이후만 표시 (지난 건 숨김). 모두 지났으면 empty 상태.
  const upcoming = items.filter((i) => i.days >= 0).slice(0, limit);

  if (loading && items.length === 0) return null;

  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <h3 className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Target className="h-3.5 w-3.5" />
        다음 D-day
      </h3>
      {upcoming.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 px-1 py-2">예정된 D-day 없음</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {upcoming.map((it) => (
            <li key={it.id}>
              <Link
                href={href(it)}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors"
                title={`${it.fullTitle} · ${it.date}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {it.kind === "travel" ? (
                    <Plane className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: it.color ?? "#3B82F6" }}
                    />
                  )}
                  <span className="truncate text-sm">{it.label}</span>
                </div>
                <span
                  className={`shrink-0 tabular-nums text-xs font-semibold ${
                    it.days === 0
                      ? "text-primary"
                      : it.days <= 7
                        ? "text-orange-600"
                        : "text-muted-foreground"
                  }`}
                >
                  {formatDdayLabel(it.days)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

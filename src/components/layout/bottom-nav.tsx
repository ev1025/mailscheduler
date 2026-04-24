"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Calendar,
  Plane,
  Wallet,
  BookOpen,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/current-user";
import { useNotifications } from "@/hooks/use-notifications";

// 모바일 하단 네비. 캘린더 | 여행 | 가계부 | 지식 | 프로필
// 여행은 /calendar?view=travel (캘린더 라우트 공유, view 쿼리로 구분)

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  /** 추가 match path prefix */
  also?: string[];
  /** 추가 match view 쿼리값 목록 (/calendar 라우트에서 view 구분) */
  views?: string[];
  /** 이 항목이 캘린더 라우트의 "기본" 이면 view 쿼리가 없거나 calendar/database 일 때만 active */
  isCalendarDefault?: boolean;
};

const navItems: NavItem[] = [
  {
    href: "/calendar",
    label: "캘린더",
    icon: Calendar,
    isCalendarDefault: true,
  },
  {
    href: "/calendar?view=travel",
    label: "여행",
    icon: Plane,
    views: ["travel", "travel-plans", "travel-plan"],
  },
  { href: "/finance", label: "가계부", icon: Wallet, also: ["/products"] },
  { href: "/knowledge", label: "지식", icon: BookOpen },
];

export default function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const currentUser = useCurrentUser();
  const { unreadCount } = useNotifications();
  const profileActive = pathname === "/profile" || pathname.startsWith("/profile/");

  const isActive = (item: NavItem): boolean => {
    // 여행 탭: /calendar + view 쿼리가 travel 계열
    if (item.views && item.views.length > 0) {
      return pathname === "/calendar" && !!viewParam && item.views.includes(viewParam);
    }
    // 캘린더 기본 탭: /calendar + view 가 travel 계열이 아님
    if (item.isCalendarDefault) {
      if (pathname !== "/calendar") return false;
      if (viewParam && ["travel", "travel-plans", "travel-plan"].includes(viewParam)) return false;
      return true;
    }
    // 기타: path 기반
    if (pathname === item.href || pathname.startsWith(item.href + "/")) return true;
    if (item.also?.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
    return false;
  };

  return (
    // 강한 frosted blur + 아주 연한 border → 네이티브 앱 탭바 느낌.
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/30 bg-background/75 backdrop-blur-xl md:hidden pb-safe">
      <div className="flex h-14 items-stretch justify-around">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-[3px] px-1 text-[11px] transition-colors",
                active ? "text-primary font-semibold" : "text-muted-foreground"
              )}
            >
              {/* 아이콘 뒤 pill — active 시 primary 틴트 배경 (iOS/Material hybrid) */}
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  active ? "bg-primary/12" : "bg-transparent"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[22px] w-[22px] transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                    active && "stroke-[2.3]"
                  )}
                />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Link
          href="/profile"
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-[3px] px-1 text-[11px] transition-colors",
            profileActive ? "text-primary font-semibold" : "text-muted-foreground"
          )}
        >
          {unreadCount > 0 && (
            <span className="absolute top-1 right-[calc(50%-6px)] h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
          )}
          <span
            className={cn(
              "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
              profileActive ? "bg-primary/12" : "bg-transparent"
            )}
          >
            {currentUser ? (
              <span
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] overflow-hidden"
                style={
                  currentUser.avatar_url
                    ? { backgroundColor: "transparent" }
                    : {
                        backgroundColor: currentUser.color + "30",
                        color: currentUser.color,
                      }
                }
              >
                {currentUser.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  currentUser.emoji || currentUser.name[0]
                )}
              </span>
            ) : (
              <User
                className={cn(
                  "h-[22px] w-[22px] transition-colors",
                  profileActive ? "text-primary" : "text-muted-foreground",
                  profileActive && "stroke-[2.3]"
                )}
              />
            )}
          </span>
          <span>프로필</span>
        </Link>
      </div>
    </nav>
  );
}

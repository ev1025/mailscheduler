"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Wallet, StickyNote, Pill, PanelLeftClose, PanelLeftOpen, Bell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNotifications } from "@/lib/notifications";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const navItems = [
  { href: "/calendar", label: "캘린더", icon: Calendar },
  { href: "/finance", label: "가계부", icon: Wallet },
  { href: "/memo", label: "메모", icon: StickyNote },
  { href: "/supplements", label: "영양제", icon: Pill },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [notiOpen, setNotiOpen] = useState(false);
  const notifications = getNotifications();

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col md:border-r transition-all duration-200",
        collapsed ? "md:w-14" : "md:w-52"
      )}
    >
      {/* 접기 버튼 */}
      <div className={cn("flex h-12 items-center border-b", collapsed ? "justify-center" : "justify-end px-2")}>
        <button
          onClick={onToggle}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className={cn("flex flex-1 flex-col gap-0.5 pt-2", collapsed ? "px-1.5" : "px-2")}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-md transition-colors",
                collapsed
                  ? "justify-center p-2.5"
                  : "gap-2.5 px-2.5 py-1.5 text-[13px]",
                isActive
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* 하단: 알림 + 설정 */}
      <div className={cn("border-t py-2 flex items-center", collapsed ? "justify-center gap-1 px-1" : "gap-1 px-2")}>
        <button
          onClick={() => setNotiOpen(true)}
          title="알림"
          className="relative rounded-md p-2 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
        >
          <Bell className="h-4 w-4" />
          {notifications.length > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>
        <Link
          href="/settings"
          title="설정"
          className="rounded-md p-2 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>

      {/* 알림 모달 */}
      <Dialog open={notiOpen} onOpenChange={setNotiOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>알림</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">알림이 없습니다</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "rounded-lg border p-3",
                    n.type === "warning" ? "border-orange-200 bg-orange-50" : "border-blue-200 bg-blue-50"
                  )}
                >
                  <p className={cn(
                    "text-sm font-medium",
                    n.type === "warning" ? "text-orange-800" : "text-blue-800"
                  )}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">
                    {n.message}
                  </p>
                </div>
              ))
            )}
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">API 정보</p>
              <div className="text-xs text-muted-foreground mt-1.5 space-y-1">
                <p>기상청 단기예보 만료: 2028-04-12</p>
                <p>기상청 중기예보 만료: 2028-04-12</p>
                <p>갱신: data.go.kr (네이버 간편로그인)</p>
                <p>Open-Meteo: 만료 없음 (무료)</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

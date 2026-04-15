"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Settings, MoreVertical } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications } from "@/hooks/use-notifications";
import NotificationsPanel from "./notifications-panel";

export default function MobileHeader() {
  const [notiOpen, setNotiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-8 items-center justify-end border-b bg-background/95 backdrop-blur-lg px-2 pt-safe">
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger
            className="relative flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground active:bg-accent"
            aria-label="더보기"
          >
            <MoreVertical className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500" />
            )}
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="end" side="bottom">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setNotiOpen(true); }}
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-sm hover:bg-accent"
            >
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                알림
              </span>
              {unreadCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              설정
            </Link>
          </PopoverContent>
        </Popover>
      </header>
      <NotificationsPanel open={notiOpen} onOpenChange={setNotiOpen} />
    </>
  );
}

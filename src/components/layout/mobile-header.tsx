"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import NotificationsPanel from "./notifications-panel";

export default function MobileHeader() {
  const [notiOpen, setNotiOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-9 items-center justify-end border-b bg-background/95 backdrop-blur-lg px-2 pt-safe">
        <button
          type="button"
          onClick={() => setNotiOpen(true)}
          className="relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-accent"
          aria-label="알림"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </header>
      <NotificationsPanel open={notiOpen} onOpenChange={setNotiOpen} />
    </>
  );
}

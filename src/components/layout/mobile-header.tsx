"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import NotificationsPanel from "./notifications-panel";

// 별도 스트립(구분선) 없이 우측 상단에 떠있는 알림 버튼만.
// safe-area만 고려해 띄우고, 본문 위에 투명하게 올려둔다.
export default function MobileHeader() {
  const [notiOpen, setNotiOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <>
      <button
        type="button"
        onClick={() => setNotiOpen(true)}
        aria-label="알림"
        className="md:hidden fixed top-[calc(env(safe-area-inset-top)+0.25rem)] right-2 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground shadow-sm ring-1 ring-foreground/10 active:bg-accent"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <NotificationsPanel open={notiOpen} onOpenChange={setNotiOpen} />
    </>
  );
}

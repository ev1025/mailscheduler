"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import NotificationsPanel from "./notifications-panel";

/**
 * 모바일 페이지 헤더 우측에 인라인으로 놓는 알림 벨.
 * 고정 스트립이 아니라, 각 페이지의 기존 헤더 안에 자리잡음.
 */
export default function MobileBell() {
  const [notiOpen, setNotiOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <>
      <button
        type="button"
        onClick={() => setNotiOpen(true)}
        aria-label="알림"
        className="md:hidden relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent active:bg-accent"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <NotificationsPanel open={notiOpen} onOpenChange={setNotiOpen} />
    </>
  );
}

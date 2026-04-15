"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import NotificationsPanel from "./notifications-panel";

interface Props {
  title: React.ReactNode;
  /** 타이틀 왼쪽에 뒤로가기 ← 버튼 표시 (router.back()) */
  showBack?: boolean;
  /** 타이틀 아래에 부제/서브텍스트 */
  subtitle?: React.ReactNode;
  /** 타이틀과 bell 사이에 페이지별 액션 (예: + 추가 버튼) */
  actions?: React.ReactNode;
  /** 기본값 true — 우측 끝에 알림 벨 표시 */
  showBell?: boolean;
}

/**
 * 모바일/데스크톱 공용 페이지 헤더.
 * 모든 페이지가 같은 높이와 여백을 쓰도록 표준화.
 * 좌측: (옵션) 뒤로가기 + 타이틀
 * 우측: actions + 알림 벨
 */
export default function PageHeader({
  title,
  showBack,
  subtitle,
  actions,
  showBell = true,
}: Props) {
  const router = useRouter();
  const [notiOpen, setNotiOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-3 pt-safe">
        {showBack && (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent -ml-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex flex-col min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {actions}
          {showBell && (
            <button
              type="button"
              onClick={() => setNotiOpen(true)}
              aria-label="알림"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <Bell className="h-[22px] w-[22px]" strokeWidth={1.6} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>
      <NotificationsPanel open={notiOpen} onOpenChange={setNotiOpen} />
    </>
  );
}

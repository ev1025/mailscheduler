"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import BottomNav from "./bottom-nav";
import { getNotifications } from "@/lib/notifications";
import { toast } from "sonner";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // 만료 임박 시 자동 알림 (세션당 1회)
  useEffect(() => {
    const shown = sessionStorage.getItem("noti-shown");
    if (shown) return;

    const notifications = getNotifications();
    if (notifications.length > 0) {
      sessionStorage.setItem("noti-shown", "1");
      setTimeout(() => {
        for (const n of notifications) {
          toast.warning(n.title, {
            description: n.message.split("\n")[0],
            duration: 10000,
          });
        }
      }, 2000);
    }
  }, []);

  return (
    <div className="flex h-full min-h-dvh">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

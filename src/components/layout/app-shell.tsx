"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import BottomNav from "./bottom-nav";
import UserSwitcher from "./user-switcher";
import {
  useCurrentUserId,
  setCurrentUserId,
  useAppUsers,
  getCurrentUserId,
} from "@/lib/current-user";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const currentId = useCurrentUserId();
  const { users, loading } = useAppUsers();
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || loading) return;
    if (!currentId) {
      // 자동 로그인 없음 → 로그인 화면
      setGateOpen(true);
    } else if (!users.find((u) => u.id === currentId)) {
      // 저장된 ID가 삭제된 경우 초기화
      setCurrentUserId(null);
      setGateOpen(true);
    } else {
      setGateOpen(false);
    }
  }, [hydrated, loading, users, currentId]);

  return (
    <div className="flex h-full min-h-dvh">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
      <BottomNav />

      <UserSwitcher
        open={gateOpen}
        onOpenChange={(o) => {
          // localStorage를 직접 확인해서 클로저 캡처 문제 회피
          if (!o && !getCurrentUserId()) return;
          setGateOpen(o);
        }}
        allowClose={!!currentId}
      />
    </div>
  );
}

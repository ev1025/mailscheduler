"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "./sidebar";
import BottomNav from "./bottom-nav";
import MobileHeader from "./mobile-header";
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
  const { users, loading, refetch } = useAppUsers();
  const [gateOpen, setGateOpen] = useState(false);
  const refetchedFor = useRef<string | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || loading) return;
    if (!currentId) {
      setGateOpen(true);
      return;
    }
    if (users.find((u) => u.id === currentId)) {
      setGateOpen(false);
      refetchedFor.current = null;
      return;
    }
    // users에 없음 → 방금 가입/로그인한 사용자가 stale한 것일 수 있으니 한 번 재조회.
    if (refetchedFor.current !== currentId) {
      refetchedFor.current = currentId;
      refetch();
      return;
    }
    // 재조회했는데도 없으면 실제로 삭제된 ID → 로그아웃.
    setCurrentUserId(null);
    setGateOpen(true);
  }, [hydrated, loading, users, currentId, refetch]);

  return (
    <div className="flex h-full min-h-dvh">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <MobileHeader />
      <main className="flex-1 overflow-y-auto pt-12 pb-safe-nav md:pb-0 md:pt-0">
        {children}
      </main>
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

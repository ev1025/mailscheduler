"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import BottomNav from "./bottom-nav";
import MobileHeader from "./mobile-header";
import UserSwitcher from "./user-switcher";
import { useSupabaseAuth } from "@/lib/auth-supabase";
import { useCurrentUser, useAppUsers } from "@/lib/current-user";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  const { user: authUser, loading: authLoading } = useSupabaseAuth();
  const { loading: usersLoading } = useAppUsers();
  const currentUser = useCurrentUser();

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || authLoading || usersLoading) return;
    // 세션 없음 → 로그인 필요
    if (!authUser) {
      setGateOpen(true);
      return;
    }
    // 세션 있으나 app_users 프로필 없음 → 프로필 생성 필요
    if (!currentUser) {
      setGateOpen(true);
      return;
    }
    setGateOpen(false);
  }, [hydrated, authLoading, usersLoading, authUser, currentUser]);

  const allowClose = !!authUser && !!currentUser;

  return (
    <div className="flex h-full min-h-dvh">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <MobileHeader />
      <main className="flex-1 overflow-y-auto pt-9 pb-safe-nav md:pb-0 md:pt-0">
        {children}
      </main>
      <BottomNav />

      <UserSwitcher
        open={gateOpen}
        onOpenChange={(o) => {
          if (!o && !allowClose) return;
          setGateOpen(o);
        }}
        allowClose={allowClose}
      />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./sidebar";
import BottomNav from "./bottom-nav";
import UserSwitcher from "./user-switcher";
import { useSupabaseAuth } from "@/lib/auth-supabase";
import { useCurrentUser, useAppUsers } from "@/lib/current-user";
import { supabase } from "@/lib/supabase";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const router = useRouter();

  const { user: authUser, loading: authLoading } = useSupabaseAuth();
  const { loading: usersLoading } = useAppUsers();
  const currentUser = useCurrentUser();

  useEffect(() => {
    setHydrated(true);
  }, []);

  // 비밀번호 재설정 메일 링크로 돌아왔을 때 자동으로 프로필 페이지의
  // 비밀번호 변경 다이얼로그로 유도 — AppShell은 항상 마운트돼 있으므로
  // 어느 페이지에 떨어져도 잡아낼 수 있음.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/profile?action=reset-password");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

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
    <div className="flex h-dvh overflow-hidden fixed inset-0 md:static md:h-full md:min-h-dvh">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-none pt-safe pb-safe-nav md:pb-0 md:pt-0">
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

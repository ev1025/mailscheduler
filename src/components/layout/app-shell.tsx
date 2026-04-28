"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "./sidebar";
import BottomNav from "./bottom-nav";
import UserSwitcher from "./user-switcher";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useSupabaseAuth } from "@/lib/auth-supabase";
import { useCurrentUser, useAppUsers } from "@/lib/current-user";
import { supabase } from "@/lib/supabase";
import { setExitConfirmHandler, confirmExit, pushExitGuardIfNeeded } from "@/lib/dialog-stack";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // 지식창고 진입 시 앱 사이드바 자동 접기 — 내부 탐색기 사이드바와 공간 중복 방지.
  // pathname 변경될 때만 트리거 → 사용자가 지식창고 안에서 수동으로 펼치면 유지됨.
  useEffect(() => {
    if (pathname?.startsWith("/knowledge")) {
      setCollapsed(true);
    }
  }, [pathname]);

  const { user: authUser, loading: authLoading } = useSupabaseAuth();
  const { loading: usersLoading } = useAppUsers();
  const currentUser = useCurrentUser();

  useEffect(() => {
    setHydrated(true);
  }, []);

  // 스탠드얼론 PWA 에서 다이얼로그 없는 상태로 뒤로가기 누르면 보여줄 종료 확인.
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  useEffect(() => {
    setExitConfirmHandler(() => setExitConfirmOpen(true));
    return () => setExitConfirmHandler(null);
  }, []);

  // pathname 변경 시 가드는 push 하지 않음 — push 하면 in-app 탭 이동 back 이
  // 무조건 종료 확인으로만 떨어져 사용자 의도와 충돌. 초기 가드 (ensureListener
  // 안에서 한 번만 push) 만 두고, 탭 사이 back-nav 는 Next.js 가 자연스럽게 처리.
  // 사용자가 history 끝(가드)까지 도달하면 그때 종료 확인 표시.

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

  // 레이아웃 전략:
  //  - 모바일: 전체 화면 고정(fixed inset-0 h-dvh) + main 내부 스크롤.
  //    바텀네비가 절대/고정이라 document 스크롤은 회피.
  //  - 데스크탑: document-level 자연 스크롤. Sidebar 는 md:fixed 로 left-0
  //    고정 + main 은 sidebar 너비만큼 padding-left. 내부 스크롤 컨테이너
  //    없음 → 자식 페이지 어디를 휠해도 body 가 스크롤됨.
  //
  // 이전엔 데스크탑에서도 main 에 overflow-y-auto 를 걸어 내부 스크롤 방식
  // (overflow-hidden parent + 내부 scroll container) 이었는데, 이 구조가
  //  - 중간에 overflow-hidden 을 가진 자식이 있으면 scroll event 가 격리
  //  - flex / min-h-0 체인이 한 곳에서 끊기면 스크롤 불가
  //  - 특정 child (지도·DnD) 가 wheel 을 먹으면 main 까지 전달 안 됨
  // 모두 발생시켜 여러 PR 에서도 해결 못했음. document-level 스크롤로
  // 한 번에 해소.
  const sidebarPadding = collapsed ? "md:pl-14" : "md:pl-52";

  return (
    <>
      {/* Sidebar: 데스크탑에선 fixed, 모바일에선 hidden (Sidebar 내부에서 hidden md:flex 처리).
          useSearchParams 를 쓰므로 Suspense 로 감쌈. */}
      <Suspense fallback={null}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
      </Suspense>

      {/* Main: 모바일=화면 고정 내부스크롤 / 데스크탑=document 스크롤 */}
      <main
        className={`
          fixed inset-0 overflow-y-auto overflow-x-hidden overscroll-none pt-safe pb-safe-nav
          md:static md:inset-auto md:overflow-visible md:overflow-x-visible md:overscroll-auto md:pt-0 md:pb-0
          ${sidebarPadding}
        `}
      >
        {children}
      </main>

      {/* BottomNav 는 useSearchParams 를 쓰므로 prerender 시 Suspense 필요 */}
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>

      <UserSwitcher
        open={gateOpen}
        onOpenChange={(o) => {
          if (!o && !allowClose) return;
          setGateOpen(o);
        }}
        allowClose={allowClose}
      />

      {/* 스탠드얼론 PWA 종료 확인 — 뒤로가기로 빠져나가려는 시점에 한번 더 묻기. */}
      <ConfirmDialog
        open={exitConfirmOpen}
        onOpenChange={setExitConfirmOpen}
        title="앱을 종료하시겠습니까?"
        confirmLabel="종료"
        destructive
        onConfirm={() => {
          setExitConfirmOpen(false);
          confirmExit();
        }}
      />
    </>
  );
}

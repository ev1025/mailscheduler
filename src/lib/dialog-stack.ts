// 모바일 하드웨어 백버튼 공용 처리.
// Dialog, Sheet 등 overlay UI가 공유하는 단일 popstate 스택.
// 중첩된 오버레이에서 뒤로가기는 가장 최근 것만 닫고,
// 코드로 닫힐 때는 history.back()이 상위로 전파되지 않도록 suppress 카운트를 사용한다.
//
// PWA 스탠드얼론 모드: 다이얼로그 없는 상태에서 뒤로가기 누르면 그대로 앱 종료되던
// 문제 해결을 위해 앱 시작 시 가드 엔트리를 push 한다. 가드 popstate 가 잡히면
// 1) 가드를 재push 하고 2) exitConfirmHandler 콜백 호출 → 종료 확인 다이얼로그 표시.
// 일반 브라우저 모드는 표준 뒤로가기 동작 보존.

import * as React from "react";

type StackEntry = { id: number; close: () => void };
const stack: StackEntry[] = [];
let bound = false;
let suppressCount = 0;
let nextId = 1;
let exitConfirmHandler: (() => void) | null = null;
let isStandalonePwa = false;
// URL 추적 — popstate 시 "실제 라우트 이동인지 vs 단순 가드 pop인지" 구분.
// pushState/replaceState 를 패치해 모든 URL 변화를 잡음.
let lastTrackedUrl = "";
// "사용자가 종료 확인했음" 플래그 — 다음 popstate 한 번은 가로채지 않고 통과.
let userConfirmedExit = false;

export function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // Chrome/Edge/PWA: display-mode: standalone
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari: navigator.standalone
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return !!nav.standalone;
}

/** 가드 엔트리가 history 의 현재 상태가 아닐 경우에만 새로 push.
 *  AppShell 에서 pathname 변경마다 호출하면 어느 페이지에서 back 을 눌러도
 *  먼저 가드를 pop 하면서 종료 확인 다이얼로그가 떠 in-app 라우팅을 가로챔.
 *
 *  중요: 기존 state 를 spread 로 머지해서 Next.js 의 __next (라우터 트리) 메타데이터를
 *  유지해야 함. 안 그러면 popstate 시 Next.js 핸들러가 state.__next 를 잃은 걸 보고
 *  "외부 navigation" 으로 간주해 강제 라우팅 → 이전 페이지로 점프하는 동시에 우리
 *  exit confirm 도 떠 두 가지 효과가 충돌. */
export function pushExitGuardIfNeeded() {
  if (typeof window === "undefined") return;
  if (!detectStandalone()) return;
  const cur = (window.history.state || {}) as Record<string, unknown> & {
    __exitGuard?: boolean;
  };
  if (cur.__exitGuard) return;
  window.history.pushState({ ...cur, __exitGuard: true }, "");
}

function ensureListener() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  isStandalonePwa = detectStandalone();
  lastTrackedUrl = window.location.href;

  // pushState / replaceState 패치 — 모든 URL 변화를 lastTrackedUrl 에 반영.
  // Next.js router.push 는 내부에서 pushState 를 호출하므로 라우트 이동 시 자동 추적.
  const origPushState = window.history.pushState;
  window.history.pushState = function (...args) {
    const result = origPushState.apply(this, args);
    lastTrackedUrl = window.location.href;
    return result;
  };
  const origReplaceState = window.history.replaceState;
  window.history.replaceState = function (...args) {
    const result = origReplaceState.apply(this, args);
    lastTrackedUrl = window.location.href;
    return result;
  };

  // 스탠드얼론 PWA: 첫 가드 엔트리 push — 뒤로가기 한 번은 popstate 로 잡혀서
  // 앱 종료 확인 표시 가능. 일반 브라우저는 push 안 함 (표준 뒤로가기 보존).
  if (isStandalonePwa) {
    const cur = window.history.state as { __exitGuard?: boolean } | null;
    if (!cur?.__exitGuard) {
      window.history.pushState({ __exitGuard: true }, "");
    }
  }

  window.addEventListener("popstate", () => {
    const currentUrl = window.location.href;
    const urlChanged = currentUrl !== lastTrackedUrl;
    lastTrackedUrl = currentUrl;

    if (suppressCount > 0) {
      suppressCount--;
      return;
    }
    const top = stack.pop();
    if (top) {
      top.close();
      return;
    }

    // 사용자가 방금 "종료" 확정한 직후의 popstate 한 번은 통과.
    if (userConfirmedExit) {
      userConfirmedExit = false;
      return;
    }

    // URL 이 바뀌었으면 in-app 라우트 이동 — Next.js 가 처리하니 우리는 개입 안 함.
    if (urlChanged) {
      return;
    }

    // URL 동일 + 스택 비어있음 = 사용자가 가드 엔트리에서 back 누름 = 종료 의도.
    if (isStandalonePwa && exitConfirmHandler) {
      // 가드 재push 해서 종료 취소 시 다시 가드 위에 머물도록.
      const cur = (window.history.state || {}) as Record<string, unknown> & {
        __exitGuard?: boolean;
      };
      if (!cur.__exitGuard) {
        window.history.pushState({ ...cur, __exitGuard: true }, "");
      }
      exitConfirmHandler();
    }
  });
}

/** 앱 종료 확인 다이얼로그를 띄울 콜백 등록. AppShell 마운트 시 한 번만 설정. */
export function setExitConfirmHandler(cb: (() => void) | null) {
  exitConfirmHandler = cb;
  ensureListener();
}

/**
 * 사용자가 "종료" 확인 → 실제 PWA 종료 시도.
 *
 * 동작 원리:
 *  1. userConfirmedExit 플래그로 우리 popstate 핸들러가 다시 가로채지 않도록.
 *  2. window.close() 시도 — JS 로 연 창에서만 동작하지만 일부 PWA 환경에서는 닫힘.
 *  3. history.go(-length) 로 모든 엔트리 pop → 진입점(index 0) 도달.
 *  4. 100ms 후 다시 history.back() — 진입점에서 한 번 더 back 은 표준 PWA 의
 *     "앱 닫기" 동작. Chrome/Edge PWA 가 종료시킴.
 *
 * 한계: 모든 단계 합쳐도 PWA 가 명시적으로 닫히지 않는 환경(특정 iOS 버전 등) 이
 * 있을 수 있음. 그 경우 사용자는 진입점에 머물게 됨 — 다음 hardware back 으로 종료.
 */
export function confirmExit() {
  if (typeof window === "undefined") return;
  userConfirmedExit = true;
  // 시도 1: window.close — PWA 환경에 따라 가능.
  try { window.close(); } catch { /* noop */ }
  // 시도 2: 모든 history 엔트리 빠져나가기. browser 가 index 0 에서 자동 cap.
  // length 가 1 이면 go(0) = 새로고침이라 안전하지 않음 → -1 보장.
  const depth = Math.max(1, window.history.length);
  window.history.go(-depth);
  // 시도 3: 진입점에서 한 번 더 back → 표준 standalone PWA 종료.
  setTimeout(() => {
    userConfirmedExit = true;
    try { window.close(); } catch { /* noop */ }
    window.history.back();
  }, 100);
}

export function pushDialogEntry(close: () => void): number {
  ensureListener();
  const id = nextId++;
  stack.push({ id, close });
  if (typeof window !== "undefined") {
    window.history.pushState({ __dlg: id }, "");
  }
  return id;
}

export function popDialogEntry(id: number) {
  const idx = stack.findIndex((e) => e.id === id);
  if (idx === -1) return;
  stack.splice(idx, 1);
  if (typeof window === "undefined") return;
  const state = window.history.state as { __dlg?: number } | null;
  if (state && state.__dlg === id) {
    suppressCount++;
    window.history.back();
  }
}

/**
 * Dialog/Sheet 같은 overlay 컴포넌트에서 open 상태를 스택에 연결하는 훅.
 * open=true가 되면 push, false가 되거나 unmount되면 pop.
 */
export function useDialogStackEntry(
  open: boolean | undefined,
  onClose: ((o: boolean) => void) | undefined
) {
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });
  React.useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const id = pushDialogEntry(() => {
      onCloseRef.current?.(false);
    });
    return () => {
      popDialogEntry(id);
    };
  }, [open]);
}

// ── 모바일 바텀시트 single-instance 제한 ─────────────────────
// "한 번에 하나만 열림" 보장용. TagInput 등 sub-sheet 가 여러 개 스택되어
// 분류·태그 시트가 겹쳐 뜨는 문제 방지.
// 새로 열리는 sheet 가 registerExclusiveSheet 호출 시 이전 활성 sheet 자동 닫힘.

let activeExclusiveSheetClose: (() => void) | null = null;

export function useExclusiveBottomSheet(
  open: boolean,
  close: () => void
) {
  const closeRef = React.useRef(close);
  React.useEffect(() => {
    closeRef.current = close;
  });
  React.useEffect(() => {
    if (!open) return;
    // 이전 활성 시트 닫기
    const prevClose = activeExclusiveSheetClose;
    if (prevClose) prevClose();
    // 이 시트 활성 등록
    const myClose = () => closeRef.current();
    activeExclusiveSheetClose = myClose;
    return () => {
      if (activeExclusiveSheetClose === myClose) {
        activeExclusiveSheetClose = null;
      }
    };
  }, [open]);
}

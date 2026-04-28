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

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // Chrome/Edge/PWA: display-mode: standalone
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari: navigator.standalone
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return !!nav.standalone;
}

function ensureListener() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  isStandalonePwa = detectStandalone();
  // 스탠드얼론 PWA: 첫 가드 엔트리 push — 뒤로가기 한 번은 popstate 로 잡혀서
  // 앱 종료 확인 표시 가능. 일반 브라우저는 push 안 함 (표준 뒤로가기 보존).
  if (isStandalonePwa) {
    const cur = window.history.state as { __exitGuard?: boolean } | null;
    if (!cur?.__exitGuard) {
      window.history.pushState({ __exitGuard: true }, "");
    }
  }
  window.addEventListener("popstate", () => {
    if (suppressCount > 0) {
      suppressCount--;
      return;
    }
    const top = stack.pop();
    if (top) {
      top.close();
      return;
    }
    // 스택 비었음 — 다이얼로그 없는 상태에서 뒤로가기.
    // 스탠드얼론 PWA 라면 종료 확인. 가드 재push 해서 사용자가 취소 후 다시 누를 수 있게.
    if (isStandalonePwa && exitConfirmHandler) {
      window.history.pushState({ __exitGuard: true }, "");
      exitConfirmHandler();
    }
  });
}

/** 앱 종료 확인 다이얼로그를 띄울 콜백 등록. AppShell 마운트 시 한 번만 설정. */
export function setExitConfirmHandler(cb: (() => void) | null) {
  exitConfirmHandler = cb;
  ensureListener();
}

/** 사용자가 종료를 확인했을 때 호출 — 가드 엔트리를 빠져나가 앱 종료 시도. */
export function confirmExit() {
  if (typeof window === "undefined") return;
  // 가드 엔트리 두 개를 한 번에 pop — 처음 push + 재push.
  // suppressCount 로 popstate 핸들러가 가드를 또 재push 하는 것을 막는다.
  suppressCount++;
  window.history.go(-2);
  // 일부 브라우저는 history 가 부족하면 그냥 멈춤. window.close 시도는 보통
  // 거부되지만 PWA 일부 환경에선 닫힘. (문서 권한 부족하면 무시됨.)
  setTimeout(() => {
    try { window.close(); } catch { /* noop */ }
  }, 50);
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

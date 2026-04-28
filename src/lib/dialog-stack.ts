// 모바일 하드웨어 백버튼 공용 처리.
// Dialog, Sheet, FormPage 등 overlay UI 가 공유하는 단일 popstate 스택.
//
// 동작:
//  - 다이얼로그/시트가 열릴 때 pushDialogEntry 로 history 에 더미 엔트리 push.
//  - 사용자가 hardware back → popstate 발생 → 스택의 top 을 pop 하고 close().
//  - 코드로 다이얼로그를 닫을 때(취소 버튼 등) popDialogEntry 가 history.back() 으로
//    엔트리를 정리. 그 popstate 는 suppressCount 로 무시.
//
// 결과: 일정 수정 폼처럼 modal 이 떠 있을 때 hardware back 누르면 앱 종료가
// 아니라 폼만 닫힘. 폼이 없는 페이지에서 back 은 브라우저 기본 동작(이전 페이지
// 또는 standalone PWA 종료) 그대로.

import * as React from "react";

type StackEntry = { id: number; close: () => void };
const stack: StackEntry[] = [];
let bound = false;
let suppressCount = 0;
let nextId = 1;

function ensureListener() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  window.addEventListener("popstate", () => {
    if (suppressCount > 0) {
      suppressCount--;
      return;
    }
    const top = stack.pop();
    if (top) top.close();
  });
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
 * open=true 가 되면 push, false 가 되거나 unmount 되면 pop.
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

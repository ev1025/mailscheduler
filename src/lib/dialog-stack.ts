// 모바일 하드웨어 백버튼 공용 처리.
// Dialog, Sheet 등 overlay UI가 공유하는 단일 popstate 스택.
// 중첩된 오버레이에서 뒤로가기는 가장 최근 것만 닫고,
// 코드로 닫힐 때는 history.back()이 상위로 전파되지 않도록 suppress 카운트를 사용한다.

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

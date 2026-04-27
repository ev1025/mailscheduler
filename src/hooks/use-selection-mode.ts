"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 다중 선택 모드 + 폴더/아이템 두 종류 항목을 동시 관리하는 훅.
 *
 * 이전엔 knowledge-dashboard, folder-note-list, knowledge-explorer 가 각자
 * { selectMode, selFolders, selItems, addToSelection, toggleSelection, exitSelect }
 * 동일 shape 을 인라인으로 반복. 한 번에 통합.
 *
 * 사용처:
 *   const sel = useSelectionMode({ onChange });
 *   sel.handleLongPress(id, "folder");  // 첫 진입
 *   sel.toggleSelection(id, "item");   // 추가/해제
 *   sel.exit();                         // 모드 종료
 */
export type SelectionItemType = "folder" | "item";

interface Options {
  /** selectMode on/off 변경 시 부모에 알림 (예: PageHeader 헤더 액션 토글). */
  onChange?: (active: boolean) => void;
}

export function useSelectionMode({ onChange }: Options = {}) {
  const [active, setActive] = useState(false);
  const [folders, setFolders] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<Set<string>>(new Set());
  /** 터치 드래그 다중선택 활성 플래그 — long-press 직후 손가락 떼지 않고 끄는 동안 true. */
  const dragRef = useRef(false);
  /** Shift+클릭 범위 선택의 기준점 ID. */
  const lastSelRef = useRef<string | null>(null);

  const exit = useCallback(() => {
    setActive(false);
    setFolders(new Set());
    setItems(new Set());
    dragRef.current = false;
    onChange?.(false);
  }, [onChange]);

  const addToSelection = useCallback((id: string, type: SelectionItemType) => {
    if (type === "folder") setFolders((p) => new Set([...p, id]));
    else setItems((p) => new Set([...p, id]));
  }, []);

  const toggleSelection = useCallback((id: string, type: SelectionItemType) => {
    if (type === "folder")
      setFolders((p) => {
        const n = new Set(p);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
      });
    else
      setItems((p) => {
        const n = new Set(p);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
      });
  }, []);

  const handleLongPress = useCallback(
    (id: string, type: SelectionItemType) => {
      setActive(true);
      onChange?.(true);
      addToSelection(id, type);
      lastSelRef.current = id;
      dragRef.current = true;
    },
    [addToSelection, onChange],
  );

  const total = folders.size + items.size;

  /** 마우스 드래그 다중선택 등에서 항목 없이 모드만 진입. */
  const enterMode = useCallback(() => {
    setActive(true);
    onChange?.(true);
  }, [onChange]);

  return {
    /** 선택 모드 활성 여부. */
    active,
    /** 선택된 폴더 id 들. */
    folders,
    /** 선택된 아이템 id 들. */
    items,
    /** 선택 총 개수. */
    total,
    /** 길게 누름 → 선택 모드 진입 + 첫 항목 자동 선택. */
    handleLongPress,
    /** 항목 없이 선택 모드만 진입 (마우스 드래그 멀티선택 등). */
    enterMode,
    /** 추가 선택 (이미 선택돼 있으면 변화 없음). */
    addToSelection,
    /** 선택 토글. */
    toggleSelection,
    /** 선택 모드 종료 + 선택 비우기. */
    exit,
    /** 터치 드래그 선택용 내부 ref. */
    dragRef,
    /** Shift+클릭 anchor 용 ref. */
    lastSelRef,
  };
}

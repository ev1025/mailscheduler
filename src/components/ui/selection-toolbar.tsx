"use client";

import { ArrowLeft, Pencil, FolderInput, Trash2, Star } from "lucide-react";

/**
 * 다중 선택 모드 툴바 — knowledge-dashboard / folder-note-list 의 검색창 자리에 들어가는
 * "← / N개 선택 / ✏️ / ⭐ / 📂 / 🗑️" 가로 행.
 *
 * 이전엔 두 컴포넌트가 거의 같은 JSX 를 인라인으로 반복.
 */
interface Props {
  totalSelected: number;
  onExit: () => void;
  /** 1개 선택 시에만 노출 — 이름 변경 진입. */
  onRename?: () => void;
  /** 1개 선택 + 노트(item) 1개 한정 — 즐겨찾기 토글. pinned 가 현재 상태. */
  onToggleFavorite?: () => void;
  favoritePinned?: boolean;
  /** 폴더 이동 — 선택 1개 이상이면 노출. */
  onMove?: () => void;
  /** 일괄 삭제. */
  onDelete: () => void;
}

export default function SelectionToolbar({
  totalSelected,
  onExit,
  onRename,
  onToggleFavorite,
  favoritePinned,
  onMove,
  onDelete,
}: Props) {
  return (
    <div className="flex h-9 items-center gap-0.5 -mx-1">
      <button
        type="button"
        onClick={onExit}
        aria-label="선택 해제"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
      >
        <ArrowLeft className="h-[18px] w-[18px]" />
      </button>
      <span className="flex-1 text-sm font-semibold truncate px-1">
        {totalSelected}개 선택
      </span>
      {totalSelected === 1 && onRename && (
        <button
          type="button"
          onClick={onRename}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
          title="이름 변경"
          aria-label="이름 변경"
        >
          <Pencil className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </button>
      )}
      {totalSelected === 1 && onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
          title={favoritePinned ? "즐겨찾기 해제" : "즐겨찾기"}
          aria-label={favoritePinned ? "즐겨찾기 해제" : "즐겨찾기"}
        >
          <Star
            className={`h-[18px] w-[18px] ${favoritePinned ? "fill-yellow-400 text-yellow-400" : ""}`}
            strokeWidth={1.6}
          />
        </button>
      )}
      {totalSelected > 0 && onMove && (
        <button
          type="button"
          onClick={onMove}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
          title="폴더 이동"
          aria-label="폴더 이동"
        >
          <FolderInput className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={totalSelected === 0}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent disabled:opacity-30"
        title="삭제"
        aria-label="삭제"
      >
        <Trash2 className="h-[18px] w-[18px] text-destructive" strokeWidth={1.6} />
      </button>
    </div>
  );
}

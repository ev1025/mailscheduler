"use client";

export interface HeaderViewMenuItem {
  key: string;
  label: string;
  icon: React.ElementType;
  active?: boolean;
  onSelect: () => void;
}

/**
 * PageHeader actions 슬롯의 뷰 전환 컨트롤.
 *
 * 이전: 햄버거 + 드롭다운(N개 항목 숨김). 항목이 2개뿐이라 hidden nav 패턴이
 * 발견성을 깎아먹는다는 리뷰가 있어서, 모든 항목을 인라인 아이콘 버튼으로 직접
 * 노출. 활성 항목은 primary 톤 + bg-primary/10 + aria-current="page" 로 강조.
 *
 * 한 페이지당 항목 2~3개를 가정. 그 이상이면 햄버거 폴백을 다시 검토.
 */
export default function HeaderViewMenu({ items }: { items: HeaderViewMenuItem[] }) {
  return (
    <div className="flex items-center gap-1">
      {items.map(({ key, label, icon: Icon, active, onSelect }) => (
        <button
          key={key}
          type="button"
          onClick={onSelect}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            active
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 1.8 : 1.6} />
        </button>
      ))}
    </div>
  );
}

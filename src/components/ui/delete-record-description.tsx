import * as React from "react";

/**
 * 삭제 ConfirmDialog 의 description 슬롯 공용 컴포넌트.
 *
 * 이전엔 가계부/고정비/제품 등에서 각자 "yyyy년 M월 d일 · 55,000원 · 카테고리"
 * 같은 점(·) 구분 한 줄 형식을 인라인으로 작성. 정보가 많아지면 줄바꿈이
 * 지저분해지고 라벨이 없어 읽기 어려움.
 *
 * 이 컴포넌트는 fields 배열을 받아 "라벨: 값" 형태로 줄바꿈해서 렌더.
 * fields 의 각 항목에 valueClassName 으로 색·tabular-nums 등 적용 가능.
 *
 * 사용:
 *   <ConfirmDialog description={
 *     <DeleteRecordDescription
 *       fields={[
 *         { label: "일자", value: "2026년 4월 28일 (화)", valueClassName: "tabular-nums" },
 *         { label: "금액", value: "-55,000원", valueClassName: "text-finance-loss tabular-nums" },
 *         { label: "카테고리", value: "통신비" },
 *       ]}
 *       footnote="삭제하면 되돌릴 수 없어요."
 *     />
 *   } />
 */
export interface DeleteRecordField {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}

interface Props {
  fields: DeleteRecordField[];
  /** 하단 작은 회색 안내문 (선택). */
  footnote?: React.ReactNode;
}

export default function DeleteRecordDescription({ fields, footnote }: Props) {
  // ConfirmDialog 본문이 flex-col items-center text-center 라 description 이 기본적으로
  // 가운데로 몰림. w-full + text-left 로 좌측 정렬·전폭 강제 → 라벨/값이 깔끔하게 정렬.
  return (
    <span className="block w-full text-left">
      <span className="block space-y-0.5">
        {fields.map((f, i) => (
          <span key={i} className="flex items-baseline gap-2 text-foreground">
            <span className="text-xs text-muted-foreground shrink-0 w-12">
              {f.label}
            </span>
            <span className={f.valueClassName}>{f.value}</span>
          </span>
        ))}
      </span>
      {footnote && (
        <span className="block mt-2 text-xs text-muted-foreground/70 break-keep">
          {footnote}
        </span>
      )}
    </span>
  );
}

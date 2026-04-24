"use client";

// 빈 상태용 심플 SVG 일러스트 모음.
// 외부 asset 없이 인라인으로 그리되, 테마 primary 컬러(--color-primary) 활용.
// 각 일러스트는 중심 원형 배경 + 주요 모티프 + 은은한 장식(점선·별) 조합.
//
// 사용 예:
//   <EmptyIllustration variant="finance" size={160} />

type Variant = "finance" | "travel" | "knowledge" | "products" | "dday" | "calendar";

interface Props {
  variant: Variant;
  size?: number;
  className?: string;
}

export default function EmptyIllustration({ variant, size = 160, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`grad-bg-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {/* 중심 원형 배경 */}
      <circle cx="80" cy="80" r="60" fill={`url(#grad-bg-${variant})`} />
      {/* 장식 점선 원 */}
      <circle
        cx="80"
        cy="80"
        r="72"
        stroke="var(--color-primary)"
        strokeOpacity="0.18"
        strokeWidth="1"
        strokeDasharray="3 5"
        fill="none"
      />
      {/* 주변 별 */}
      <Sparkle cx={28} cy={38} size={5} />
      <Sparkle cx={128} cy={44} size={7} />
      <Sparkle cx={24} cy={122} size={6} />
      <Sparkle cx={134} cy={120} size={5} />
      {/* 변형별 모티프 */}
      {variant === "finance" && <PiggyBankMotif />}
      {variant === "travel" && <SuitcaseMotif />}
      {variant === "knowledge" && <NotebookMotif />}
      {variant === "products" && <ShoppingBagMotif />}
      {variant === "dday" && <TargetMotif />}
      {variant === "calendar" && <CalendarMotif />}
    </svg>
  );
}

/* ── 장식용 별 ── */
function Sparkle({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const s = size;
  return (
    <path
      d={`M ${cx} ${cy - s} L ${cx + s * 0.3} ${cy - s * 0.3} L ${cx + s} ${cy} L ${cx + s * 0.3} ${cy + s * 0.3} L ${cx} ${cy + s} L ${cx - s * 0.3} ${cy + s * 0.3} L ${cx - s} ${cy} L ${cx - s * 0.3} ${cy - s * 0.3} Z`}
      fill="var(--color-primary)"
      fillOpacity="0.35"
    />
  );
}

/* ── 변형별 모티프 (중심 영역 80x80 기준) ── */

function PiggyBankMotif() {
  return (
    <g>
      {/* 돼지 몸통 */}
      <ellipse cx="80" cy="88" rx="32" ry="24" fill="var(--color-primary)" fillOpacity="0.85" />
      {/* 머리 */}
      <circle cx="108" cy="78" r="14" fill="var(--color-primary)" fillOpacity="0.85" />
      {/* 귀 */}
      <path d="M 102 66 L 108 58 L 114 66 Z" fill="var(--color-primary)" fillOpacity="0.9" />
      {/* 코 */}
      <ellipse cx="115" cy="78" rx="4" ry="3" fill="white" fillOpacity="0.8" />
      <circle cx="114" cy="78" r="0.8" fill="var(--color-primary)" />
      <circle cx="116" cy="78" r="0.8" fill="var(--color-primary)" />
      {/* 눈 */}
      <circle cx="105" cy="74" r="1.2" fill="white" />
      {/* 다리 */}
      <rect x="58" y="106" width="6" height="10" rx="1" fill="var(--color-primary)" fillOpacity="0.85" />
      <rect x="74" y="106" width="6" height="10" rx="1" fill="var(--color-primary)" fillOpacity="0.85" />
      <rect x="92" y="106" width="6" height="10" rx="1" fill="var(--color-primary)" fillOpacity="0.85" />
      {/* 동전 투입구 */}
      <rect x="72" y="68" width="16" height="3" rx="1" fill="white" fillOpacity="0.7" />
      {/* 꼬리 */}
      <path d="M 48 82 Q 42 78 46 72" stroke="var(--color-primary)" strokeOpacity="0.85" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* 떨어지는 동전 */}
      <circle cx="80" cy="56" r="5" fill="#F59E0B" />
      <text x="80" y="59" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">₩</text>
    </g>
  );
}

function SuitcaseMotif() {
  return (
    <g>
      {/* 손잡이 */}
      <rect x="68" y="48" width="24" height="8" rx="4" stroke="var(--color-primary)" strokeWidth="2.5" fill="none" />
      {/* 본체 */}
      <rect x="50" y="58" width="60" height="46" rx="5" fill="var(--color-primary)" fillOpacity="0.85" />
      {/* 세로줄 */}
      <line x1="80" y1="58" x2="80" y2="104" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
      {/* 잠금 */}
      <circle cx="80" cy="81" r="4" fill="white" fillOpacity="0.9" />
      <circle cx="80" cy="81" r="1.5" fill="var(--color-primary)" />
      {/* 라벨 */}
      <rect x="56" y="64" width="14" height="10" rx="1" fill="white" fillOpacity="0.7" />
      {/* 비행기 자국(dashed path) */}
      <path d="M 22 36 Q 50 20 88 28" stroke="var(--color-primary)" strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="2 3" fill="none" />
      {/* 작은 비행기 */}
      <path d="M 88 28 L 96 26 L 92 30 L 98 32 L 90 32 Z" fill="var(--color-primary)" fillOpacity="0.7" />
    </g>
  );
}

function NotebookMotif() {
  return (
    <g>
      {/* 뒷 페이지 */}
      <rect x="56" y="48" width="48" height="64" rx="3" fill="var(--color-primary)" fillOpacity="0.3" transform="rotate(-5 80 80)" />
      {/* 앞 노트 */}
      <rect x="52" y="52" width="54" height="64" rx="4" fill="white" stroke="var(--color-primary)" strokeWidth="2" />
      {/* 줄 */}
      <line x1="62" y1="68" x2="96" y2="68" stroke="var(--color-primary)" strokeOpacity="0.3" strokeWidth="1.5" />
      <line x1="62" y1="78" x2="90" y2="78" stroke="var(--color-primary)" strokeOpacity="0.3" strokeWidth="1.5" />
      <line x1="62" y1="88" x2="96" y2="88" stroke="var(--color-primary)" strokeOpacity="0.3" strokeWidth="1.5" />
      <line x1="62" y1="98" x2="80" y2="98" stroke="var(--color-primary)" strokeOpacity="0.3" strokeWidth="1.5" />
      {/* 코일 구멍 */}
      <circle cx="52" cy="62" r="2" fill="var(--color-primary)" fillOpacity="0.5" />
      <circle cx="52" cy="82" r="2" fill="var(--color-primary)" fillOpacity="0.5" />
      <circle cx="52" cy="102" r="2" fill="var(--color-primary)" fillOpacity="0.5" />
      {/* 연필 */}
      <g transform="rotate(40 112 58)">
        <rect x="104" y="52" width="28" height="5" rx="1" fill="#F59E0B" />
        <rect x="100" y="52" width="5" height="5" fill="#E11D48" />
        <path d="M 132 52 L 138 54.5 L 132 57 Z" fill="#374151" />
      </g>
    </g>
  );
}

function ShoppingBagMotif() {
  return (
    <g>
      {/* 손잡이 */}
      <path d="M 62 54 Q 62 38 80 38 Q 98 38 98 54" stroke="var(--color-primary)" strokeWidth="3" fill="none" />
      {/* 가방 본체 */}
      <path d="M 50 54 L 54 116 L 106 116 L 110 54 Z" fill="var(--color-primary)" fillOpacity="0.85" />
      {/* 하이라이트 */}
      <path d="M 52 54 L 55 114" stroke="white" strokeOpacity="0.25" strokeWidth="2" />
      {/* 라벨/택 */}
      <g transform="rotate(-10 74 72)">
        <rect x="70" y="68" width="14" height="9" rx="1" fill="white" fillOpacity="0.9" />
        <line x1="72" y1="72" x2="82" y2="72" stroke="var(--color-primary)" strokeWidth="0.8" />
      </g>
      {/* 가방 안에서 나오는 상품 느낌 */}
      <circle cx="80" cy="58" r="4" fill="#F59E0B" />
      <rect x="87" y="55" width="6" height="6" rx="1" fill="#22C55E" />
    </g>
  );
}

function TargetMotif() {
  return (
    <g>
      <circle cx="80" cy="80" r="32" stroke="var(--color-primary)" strokeOpacity="0.3" strokeWidth="3" fill="white" fillOpacity="0.6" />
      <circle cx="80" cy="80" r="22" stroke="var(--color-primary)" strokeOpacity="0.5" strokeWidth="3" fill="none" />
      <circle cx="80" cy="80" r="12" stroke="var(--color-primary)" strokeOpacity="0.75" strokeWidth="3" fill="none" />
      <circle cx="80" cy="80" r="4" fill="var(--color-primary)" />
      {/* 화살 */}
      <g transform="rotate(30 80 80)">
        <line x1="80" y1="80" x2="130" y2="50" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 130 50 L 124 54 L 128 46 Z" fill="#E11D48" />
        <path d="M 78 82 L 72 86 L 76 78 Z" fill="#374151" />
      </g>
    </g>
  );
}

function CalendarMotif() {
  return (
    <g>
      {/* 본체 */}
      <rect x="48" y="54" width="64" height="60" rx="5" fill="white" stroke="var(--color-primary)" strokeWidth="2" />
      {/* 상단 바 */}
      <rect x="48" y="54" width="64" height="14" rx="5" fill="var(--color-primary)" fillOpacity="0.85" />
      {/* 고리 */}
      <rect x="60" y="46" width="4" height="14" rx="2" fill="var(--color-primary)" />
      <rect x="96" y="46" width="4" height="14" rx="2" fill="var(--color-primary)" />
      {/* 날짜 그리드 */}
      <g fill="var(--color-primary)" fillOpacity="0.3">
        <circle cx="60" cy="80" r="2.5" />
        <circle cx="72" cy="80" r="2.5" />
        <circle cx="84" cy="80" r="2.5" />
        <circle cx="96" cy="80" r="2.5" />
        <circle cx="60" cy="92" r="2.5" />
        <circle cx="72" cy="92" r="2.5" />
        <circle cx="84" cy="92" r="2.5" />
        <circle cx="96" cy="92" r="2.5" />
        <circle cx="60" cy="104" r="2.5" />
        <circle cx="72" cy="104" r="2.5" />
      </g>
      {/* 오늘 강조 */}
      <circle cx="84" cy="92" r="5" fill="var(--color-primary)" />
      <circle cx="84" cy="92" r="2.5" fill="white" />
    </g>
  );
}

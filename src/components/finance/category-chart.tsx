"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CategoryChartProps {
  expenseByCategory: Record<string, { amount: number; color: string }>;
  totalExpense: number;
}

function formatWon(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

export default function CategoryChart({
  expenseByCategory,
  totalExpense,
}: CategoryChartProps) {
  const sorted = Object.entries(expenseByCategory).sort(
    ([, a], [, b]) => b.amount - a.amount
  );

  if (sorted.length === 0) return null;

  // SVG 원형 차트 계산
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;
  const slices = sorted.map(([name, { amount, color }]) => {
    const pct = totalExpense > 0 ? amount / totalExpense : 0;
    const offset = circumference * (1 - cumulativePercent);
    const length = circumference * pct;
    cumulativePercent += pct;
    return { name, amount, color, pct, offset, length };
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          카테고리별 지출
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* 원형 차트 */}
          <div className="shrink-0">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* 배경 원 */}
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={24}
              />
              {/* 카테고리별 호 */}
              {slices.map((slice) => (
                <circle
                  key={slice.name}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={24}
                  strokeDasharray={`${slice.length} ${circumference - slice.length}`}
                  strokeDashoffset={slice.offset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              ))}
              {/* 가운데 텍스트 */}
              <text
                x={cx}
                y={cy - 6}
                textAnchor="middle"
                className="fill-foreground text-xs font-medium"
              >
                총 지출
              </text>
              <text
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                className="fill-foreground text-sm font-bold"
              >
                {formatWon(totalExpense)}
              </text>
            </svg>
          </div>

          {/* 범례 */}
          <div className="flex flex-col gap-2 flex-1 w-full">
            {slices.map((slice) => (
              <div key={slice.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="font-medium">{slice.name}</span>
                </div>
                <span className="text-muted-foreground">
                  {formatWon(slice.amount)} ({(slice.pct * 100).toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

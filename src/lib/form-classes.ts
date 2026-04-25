// 폼(다이얼로그) 공통 타이포그래피·사이즈 상수.
// 기준: src/components/calendar/event-form.tsx 의 시각 규격.
// 한 곳에서 바꾸면 가계부·쇼핑기록·영양제 등 모든 폼에 반영됨.
//
// 사용 예)
//   import { FORM_LABEL, FORM_INPUT_PRIMARY } from "@/lib/form-classes"
//   <Label className={FORM_LABEL}>금액</Label>
//   <Input className={FORM_INPUT_PRIMARY} />

// 제목·주요 입력 (다이얼로그 최상단의 "제목 *" 같은 입력)
export const FORM_INPUT_PRIMARY = "h-9 text-sm"

// 모든 폼 입력은 PRIMARY 와 동일 — 한 폼 안에서 input/select/picker 의 폰트·높이가
// 제각각이던 문제 해결. 토큰 이름은 호환을 위해 유지(과거 호출처 다수).
export const FORM_INPUT_COMPACT = FORM_INPUT_PRIMARY

// 라벨
export const FORM_LABEL = "text-xs text-muted-foreground"

// 힌트·작은 설명·툴팁·Textarea 본문
export const FORM_HINT = "text-xs"

// Textarea 본문(플레이스홀더 포함). 현재는 FORM_HINT와 동일하지만 의미 분리.
export const FORM_TEXTAREA = "text-xs"

// 인라인 보조 버튼(같은 행에서 Input과 나란히 쓰는 "추가/취소" 등)
// FORM_INPUT_COMPACT(h-8)와 같은 행에 놓일 때 높이를 맞추기 위함.
export const FORM_BUTTON_INLINE = "h-8 text-xs"

// 페이지 상단 액션 버튼 (가계부/쇼핑기록 등의 "추가"·"고정비"처럼
// 목록 위에 가로로 나열되는 짧은 버튼). <Button size="sm"> 과 함께 씀.
// 가계부는 h-8, 쇼핑기록은 h-9로 제각각이었던 불일치를 한 기준으로 통일.
export const PAGE_ACTION_BUTTON = "h-9"

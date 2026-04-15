# 리팩토링 & 보안 이전 보고서

**작성일**: 2026-04-15
**대상**: my-dashboard (매일 캘린더)
**범위**: 코드 정리 + P0 보안 이슈 해결 (3개 PR)

---

## 1. 요약

한 세션에서 **4개의 주요 PR**을 순차적으로 배포했다. 리팩토링 1건 + 보안 이전 3건으로, 코드 품질과 프로덕션 보안을 동시에 개선했다.

| PR | 목적 | 변경 규모 |
|---|---|---|
| **Refactor** | 중복 로직 공통화 | +151 / -177 (net -26) |
| **PR1** | Supabase Auth 이전 | +288 / -1059 (net -771) |
| **PR2** | 이미지 → Supabase Storage | +700 / -26 (대부분 SQL) |
| **PR3** | DOMPurify HTML sanitize | +40 / -0 |

**총 변경**: 기능 회귀 0건, 순수 내부 정리 및 보안 강화.

---

## 2. 리팩토링 (Refactor PR — 커밋 `cbb12bd`)

### 2.1 공용 유틸 추출

**문제**: 4개의 localStorage 기반 훅(`useProductCategories`, `useTravelCategories`, `usePaymentMethods`, `useProductSubTags`)이 각자 동일한 패턴을 복붙하고 있었음 — `PALETTE` 상수, JSON `try/catch`, localStorage 읽기/쓰기 래퍼, 랜덤 색상 뽑기.

**해결**: `src/lib/tag-store.ts` 신규
- `TAG_PALETTE` (16색 팔레트)
- `randomTagColor()`
- `readLocalJSON<T>(key, fallback)`
- `writeLocalJSON(key, value)`
- `createTagId(prefix)`

각 훅에서 자체 구현을 제거하고 이 유틸을 import하도록 교체.

### 2.2 비밀번호 검증 헬퍼

**문제**: `user-switcher.tsx`에서 `const hash = await hashPassword(input, salt); if (hash !== expected) { error }` 패턴이 **4회 반복**, `const salt = generateSalt(); const hash = await hashPassword(password, salt)` 패턴이 **3회 반복**.

**해결**: `src/lib/auth.ts`에 헬퍼 2개 추가
- `verifyPassword(input, salt, hash): Promise<boolean>`
- `hashWithNewSalt(plain): Promise<{ hash, salt }>`

→ user-switcher에서 7곳 1~2줄로 축약. (단, 이 코드는 PR1에서 대부분 제거됨)

### 2.3 Dialog/Sheet 스택 훅

**문제**: `src/components/ui/dialog.tsx`와 `sheet.tsx`가 동일한 `useRef + useEffect + pushDialogEntry/popDialogEntry` 블록을 복붙.

**해결**: `src/lib/dialog-stack.ts`에 `useDialogStackEntry(open, onClose)` 훅 추가. Dialog와 Sheet 둘 다 이 훅 한 줄로 교체.

### 2.4 보류한 항목

- **Date/time range 훅 공통화** — event-form / travel-to-calendar 두 곳에서만 쓰이고 상태 세트가 미묘하게 달라 (Draft 관리 포함 여부, defaultDate 유무) 공통화하면 오히려 파라미터가 복잡해짐. 유지.
- **CATEGORY_COLORS 상수 중복** — 3곳에 있지만 각자 다른 카테고리 세트를 쓰므로 통합 불가.

---

## 3. PR1 — Supabase Auth 이전

### 3.1 문제 진단

기존 구조:
- 비밀번호를 **SHA-256 + 16byte salt** 로 해시. 2026년 GPU로 초당 수십억 계산 가능 → 사실상 평문 수준.
- RLS 정책이 모든 테이블에 `USING (true) WITH CHECK (true)` — **anon key만 있으면 누구든 모든 유저의 캘린더/가계부/메모 전부 읽고 쓰기 가능**.
- 세션은 `localStorage`에 `current_user_id` 저장 — XSS로 탈취 가능.
- 복구 질문도 동일 SHA-256 — 답변이 흔한 단어면 초 단위로 역산.

### 3.2 이전 후 구조

- **Supabase Auth 이메일 매직링크**: 비밀번호 자체가 없음. 로그인할 때마다 이메일로 일회성 링크 발송.
- 세션: Supabase 관리 (refresh token + localStorage 이동 — 여전히 XSS 위험은 있으나 DOMPurify로 방어).
- **RLS**: 모든 테이블이 `auth.uid() = app_users.auth_user_id` 기반 본인 데이터만 접근.
- 브릿지 컬럼: `app_users.auth_user_id UUID REFERENCES auth.users(id)`.
- 헬퍼 함수: `auth_app_user_id()` SECURITY DEFINER — Auth UUID → app_users.id 변환.

### 3.3 단계별 실행

| 단계 | 내용 | 커밋 |
|---|---|---|
| 1-1 | Supabase 대시보드에서 Email Auth 활성화, Redirect URL 등록 | 사용자 수동 |
| 1-2 | `ALTER TABLE app_users ADD COLUMN auth_user_id` | `18bbcf2` |
| 1-3 | `lib/auth-supabase.ts` SDK 래퍼 신규 | `b232920` |
| 1-4/5/7 | `user-switcher.tsx` 재작성 (signin/setup/edit 3모드), `current-user.ts` 단순화, `app-shell.tsx` 게이트 | `9701d8c` (**-1059/+288**) |
| 1-6 | `supabase-rls-auth.sql` — 17개 테이블 정책 재작성 | `198305b` |
| 1-8 | 빌드 + 배포 | push `198305b` |

### 3.4 제거된 로직

- `user-switcher`의 login_id, password, forgot, recovery_question 모드 → **766줄 삭제**
- `current-user.ts`의 localStorage 세션 관리, rememberedUsers, isRemembered, logout, onCurrentUserChange
- `auth.ts`의 password verify 경로는 미사용으로 남김 (다음 PR에서 제거 예정)

### 3.5 데이터 마이그레이션

기존 1개 프로필(`eg2874`, `ㅇㅇ`)은 **완전 삭제**. 사용자가 이메일로 처음 로그인할 때 `setup` 모드에서 프로필 새로 생성하는 경로로 대체.

---

## 4. PR2 — 이미지 → Supabase Storage

### 4.1 문제

- 아바타 이미지와 지식창고 이미지를 **base64 data URL로 DB에 직접 저장**. 256×256 JPEG ≈ 30KB, 1600px 이미지 ≈ 300KB. 행 단위로 수 MB가 실릴 수 있음.
- `SELECT *` 쿼리마다 전체 이미지가 페이로드로 실려옴.
- 캐시 불가, CDN 이점 전무, DB 용량 폭증 예약.

### 4.2 해결

`src/lib/storage.ts` 신규:
- `uploadToStorage(bucket, fileOrDataUrl, ext)` — File이든 data URL이든 받아서 `{auth.uid()}/{timestamp}-{random}.{ext}` 경로로 업로드 후 public URL 반환.
- `deleteFromStorage(bucket, url)` — public URL에서 path를 역산해 제거.

버킷 구조:
- `avatars` (public, 본인 폴더만 쓰기)
- `knowledge-images` (public, 본인 폴더만 쓰기)

RLS: `(storage.foldername(name))[1] = auth.uid()::text` 조건으로 타인 파일 변조 차단.

### 4.3 수정된 업로드 경로

- `user-switcher.tsx`: `AvatarCropDialog.onConfirm` → Storage 업로드 후 URL 저장, 기존 Storage 이미지는 자동 정리.
- `rich-editor.tsx`: `handleImageUpload` → canvas 축소/압축 후 Blob → File 변환 → Storage 업로드 → TipTap에 public URL 삽입.

---

## 5. PR3 — DOMPurify HTML sanitize

### 5.1 문제

TipTap 에디터가 생성하는 HTML은 ProseMirror가 편집 중에 화이트리스트 검증하지만, 누군가 Supabase REST로 `knowledge_items`에 직접 `<script>` 또는 `onerror` 속성을 넣으면 다음에 불러올 때 위험.

### 5.2 해결

`src/lib/sanitize.ts` 신규:
- `sanitizeRichHTML(html)` — DOMPurify 래퍼
- 허용 태그: `p, h1-h6, ul/ol/li, a, img, table, span, div, ...`
- 차단 태그: `script, iframe, object, embed, form`
- 차단 속성: 모든 `on*` 이벤트 핸들러
- URI: http/https/mailto/data만 허용, `javascript:` 차단

`knowledge/page.tsx`의 `handleSave`에서 저장 직전 통과. 저장 시점 방어로 DB에 오염된 HTML이 들어가는 경로를 차단.

---

## 6. 남은 작업 (이번 스프린트 범위 외)

우선순위 순:

1. **`app/error.tsx` + `global-error.tsx`** — 에러 바운더리. 지금 런타임 에러 시 사용자는 빈 화면만 봄.
2. **Sentry 또는 Axiom 연동** — 프로덕션 배포 중인데 관측 없음.
3. **zod 스키마 도입** — Supabase row를 `z.infer`로 타입 파생, `safeData()` 같은 `Record<string, unknown>` 캐스트 제거.
4. **app_settings / expense_categories를 per-user로 분리** — 현재는 전역이라 앞으로 다중 사용자 시 데이터 공유됨.
5. **service worker (next-pwa 또는 @serwist/next)** — manifest만 있고 오프라인 불가.
6. **Playwright E2E 5개** — 로그인, 일정 추가, 가계부 추가, 이미지 업로드, 로그아웃 정도.
7. **`src/lib/auth.ts`의 SHA-256 헬퍼 완전 제거** — PR1 후 미사용이나 파일은 남아 있음.

---

## 7. 교훈 & 원칙

- **"작동하는데 왜 바꿔"는 오답**: PR1 시작 전 앱은 정상 작동하고 있었지만, anon key만 있으면 DB 전체가 털리는 구조였다. "동작"과 "안전"은 다른 축.
- **보안 이전은 한 PR로 몰아서**: login 경로를 병행으로 두면 코드가 2배가 된다. 프로필 1개뿐이라 데이터 소실 위험이 낮다고 판단, 급진적으로 교체하는 쪽이 총 작업량이 훨씬 적었다 (-771줄).
- **유틸 추출은 3번째 중복에서**: 2번째 중복은 아직 우연일 수 있다. 3번째부터는 확신을 가지고 추출.
- **체크포인트를 memory에 기록**: 세션이 끊겨도 복구 가능. 특히 사용자가 "껐다 켤 수 있다"고 명시한 작업일수록 필수.

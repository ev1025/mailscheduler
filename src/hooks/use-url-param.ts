"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * URL searchParams 와 동기화되는 상태 훅.
 *
 * 패턴 통일 목적:
 *  - 현재 calendar(?view=, ?y=, ?m=), products(?category=), settings(?action=) 등 일부만 URL 반영.
 *  - finance/memo/travel-plans 는 useState 만 — 새로고침/공유 링크 시 상태 소실.
 *  - 본 훅으로 한 줄 호출 (`const [y, setY] = useUrlNumberParam("y", default)`) 로 통일.
 *
 * 동작:
 *  - 초기값: URL 의 param 이 있으면 그걸로, 없으면 defaultValue.
 *  - setValue 호출 시 URL 갱신 + state 갱신 (router.replace, scroll: false).
 *  - 같은 값으로 set 하면 history 추가 안 됨.
 *
 * 주의:
 *  - SSR 시점에 useSearchParams 반환은 빈 ReadonlyURLSearchParams (Next 15+).
 *    초기 렌더 후 useEffect 가 hydrate 한 진짜 값으로 sync.
 */

function readParam(sp: URLSearchParams | null | undefined, key: string): string | null {
  if (!sp) return null;
  return sp.get(key);
}

function buildUrl(pathname: string, sp: URLSearchParams): string {
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** 단일 string 파라미터. */
export function useUrlStringParam(
  key: string,
  defaultValue: string,
): [string, (next: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValueState] = useState<string>(() => {
    return readParam(searchParams, key) ?? defaultValue;
  });

  // SSR/CSR sync — searchParams 가 hydrate 되면 내부 state 도 맞춤.
  useEffect(() => {
    const fromUrl = readParam(searchParams, key);
    if (fromUrl !== null && fromUrl !== value) {
      setValueState(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, key]);

  const setValue = useCallback(
    (next: string) => {
      setValueState(next);
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      if (next === defaultValue) {
        sp.delete(key);
      } else {
        sp.set(key, next);
      }
      router.replace(buildUrl(pathname ?? "/", sp), { scroll: false });
    },
    [router, pathname, searchParams, key, defaultValue],
  );

  return [value, setValue];
}

/** 정수 파라미터 (y, m, page 등). */
export function useUrlNumberParam(
  key: string,
  defaultValue: number,
): [number, (next: number) => void] {
  const [strValue, setStrValue] = useUrlStringParam(key, String(defaultValue));
  const num = Number.parseInt(strValue, 10);
  const value = Number.isFinite(num) ? num : defaultValue;
  const setValue = useCallback(
    (next: number) => {
      setStrValue(String(next));
    },
    [setStrValue],
  );
  return [value, setValue];
}

"use client";

import { useEffect, useState } from "react";

// 뷰포트 사이즈에 따른 분기를 위한 훅.
// SSR 단계에서는 matches=false(기본 = 모바일)로 시작 → 하이드레이션 이후
// 실제 window.matchMedia 로 갱신. 모바일-퍼스트 설계라 기본값이 맞음.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

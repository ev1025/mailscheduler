"use client";

import { useEffect } from "react";

/**
 * 모바일 키보드가 올라왔을 때 그 높이만큼 CSS 변수 --kb-offset 으로 노출.
 *
 * viewport interactiveWidget="overlays-content" 설정으로 키보드가 뷰포트를
 * 리사이즈하지 않고 위에 덮이도록 바꿨기 때문에, bottom: 0으로 고정된
 * 바텀 시트(Sheet side="bottom")는 키보드 뒤에 숨을 수 있음.
 *
 * 이 컴포넌트가 window.visualViewport로 키보드 높이를 감지해서
 * :root에 --kb-offset 변수를 세팅 → Sheet 팝업이 bottom: var(--kb-offset)로
 * 키보드 위에 자동으로 떠있게 됨.
 */
export default function KeyboardOffset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) {
      document.documentElement.style.setProperty("--kb-offset", "0px");
      return;
    }
    const update = () => {
      // 키보드 높이 ≈ 전체 window.innerHeight - 보이는 visual viewport 높이
      // (offsetTop도 빼줘야 top이 밀렸을 때도 정확)
      const kb = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      );
      document.documentElement.style.setProperty("--kb-offset", `${kb}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return null;
}

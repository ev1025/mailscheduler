"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// 지식창고의 "선택된 노트 · 열람 중인 폴더" 상태를 URL(searchParams) 과 동기화.
// /knowledge?item=...&folder=... 형태로 사용.
// - 브라우저 뒤로가기 → state 자동 동기화
// - setSelectedItemId / setViewFolderId 는 서로 배타적 (둘 다 설정되면 item 우선)

export function useKnowledgeRouter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlItemId = searchParams.get("item");
  const urlFolderId = searchParams.get("folder");

  const [selectedItemId, _setSelectedItemId] = useState<string | null>(urlItemId);
  const [viewFolderId, _setViewFolderId] = useState<string | null>(urlFolderId);

  const pushUrl = (item: string | null, folder: string | null, push = true) => {
    const params = new URLSearchParams();
    if (item) params.set("item", item);
    if (folder) params.set("folder", folder);
    const qs = params.toString();
    const url = qs ? `/knowledge?${qs}` : "/knowledge";
    if (push) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  };

  const setSelectedItemId = (id: string | null) => {
    _setSelectedItemId(id);
    _setViewFolderId(null);
    pushUrl(id, null, !!id);
  };

  const setViewFolderId = (fid: string | null) => {
    _setViewFolderId(fid);
    _setSelectedItemId(null);
    pushUrl(null, fid, !!fid);
  };

  // 뒤로가기 시 state 를 URL 에 맞춰 자동 재동기화
  useEffect(() => {
    _setSelectedItemId(searchParams.get("item"));
    _setViewFolderId(searchParams.get("folder"));
  }, [searchParams]);

  return {
    selectedItemId,
    viewFolderId,
    setSelectedItemId,
    setViewFolderId,
    // 내부에서만 직접 state 를 조작해야 할 때 (예: 드래프트 로드 직후 timing 우회)
    _setSelectedItemIdDirect: _setSelectedItemId,
  };
}

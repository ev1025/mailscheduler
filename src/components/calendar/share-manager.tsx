"use client";

import { useState } from "react";
import PanelDialog from "@/components/ui/panel-dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, X, Users } from "lucide-react";
import { useCalendarShares } from "@/hooks/use-calendar-shares";
import { useAppUsers, useCurrentUserId } from "@/lib/current-user";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ui/confirm-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Avatar({
  user,
  size = 36,
}: {
  user: { emoji: string | null; avatar_url: string | null; name: string; color: string };
  size?: number;
}) {
  return (
    <span
      className="flex items-center justify-center rounded-full text-base shrink-0 overflow-hidden"
      style={
        user.avatar_url
          ? { width: size, height: size, backgroundColor: "transparent" }
          : {
              width: size,
              height: size,
              backgroundColor: user.color + "25",
              color: user.color,
            }
      }
    >
      {user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
      ) : (
        user.emoji || user.name[0]
      )}
    </span>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      {count !== undefined && count > 0 && (
        <span className="text-[11px] text-muted-foreground/60">{count}</span>
      )}
    </div>
  );
}

/**
 * 캘린더 공유 관리자 — 탭 분리 없는 단일 화면.
 * 받은 요청 → 공유 중 → 보낸 요청 → 초대 가능 순서로 섹션 노출.
 * 항목 없으면 섹션 자체 숨김. 초대 가능만은 항상 표시.
 */
export default function ShareManager({ open, onOpenChange }: Props) {
  const { users } = useAppUsers();
  const currentUserId = useCurrentUserId();
  const { outgoing, incoming, invite, accept, reject, cancel } =
    useCalendarShares();
  const [cancelTarget, setCancelTarget] = useState<
    | { id: string; name: string; mode: "reject-incoming" | "remove-accepted" | "cancel-outgoing" }
    | null
  >(null);

  const getUser = (id: string) => users.find((u) => u.id === id);
  const others = users.filter((u) => u.id !== currentUserId);

  const incomingPending = incoming.filter((s) => s.status === "pending");
  const incomingAccepted = incoming.filter((s) => s.status === "accepted");
  const outgoingPending = outgoing.filter((s) => s.status === "pending");
  const outgoingAccepted = outgoing.filter((s) => s.status === "accepted");

  // 초대 가능: 보낸 요청에 이미 들어 있지 않은 사용자
  const invitable = others.filter(
    (u) => !outgoing.find((s) => s.viewer_id === u.id)
  );

  const handleInvite = async (viewerId: string) => {
    const { error } = await invite(viewerId);
    if (error === "already invited") toast.info("이미 초대했습니다");
    else if (error) toast.error("초대 실패");
    else toast.success("초대를 보냈습니다");
  };

  const confirmTitle =
    cancelTarget?.mode === "reject-incoming"
      ? "공유 거절"
      : cancelTarget?.mode === "remove-accepted"
        ? "공유 해제"
        : "초대 취소";
  const confirmDesc =
    cancelTarget?.mode === "reject-incoming"
      ? `${cancelTarget?.name}님이 보낸 공유 요청을 거절합니다.`
      : cancelTarget?.mode === "remove-accepted"
        ? `${cancelTarget?.name}님과의 공유 연결을 해제합니다.`
        : `${cancelTarget?.name}님에게 보낸 초대를 취소합니다.`;
  const confirmLabel = cancelTarget?.mode === "reject-incoming" ? "거절" : "확인";

  return (
    <PanelDialog open={open} onOpenChange={onOpenChange} title="캘린더 공유">
      {/* 본문 — 섹션별 분리. */}
      <div className="px-4 py-4">
          {incomingPending.length === 0 &&
          incomingAccepted.length === 0 &&
          outgoingPending.length === 0 &&
          outgoingAccepted.length === 0 &&
          invitable.length === 0 ? (
            <EmptyState text={others.length === 0 ? "공유 가능한 사용자가 없어요" : "공유 활동이 없어요"} />
          ) : (
            <div className="flex flex-col gap-5">
              {/* 받은 요청 */}
              {incomingPending.length > 0 && (
                <section>
                  <SectionHeader title="받은 요청" count={incomingPending.length} />
                  <ul className="flex flex-col gap-2">
                    {incomingPending.map((s) => {
                      const owner = getUser(s.owner_id);
                      if (!owner) return null;
                      return (
                        <li
                          key={s.id}
                          className="flex items-center gap-3 rounded-xl border bg-card p-3"
                        >
                          <Avatar user={owner} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {owner.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              내 캘린더 보기 요청
                            </p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              className="h-9 px-3 text-xs"
                              onClick={() => accept(s.id)}
                            >
                              수락
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 px-3 text-xs"
                              onClick={() =>
                                setCancelTarget({
                                  id: s.id,
                                  name: owner.name,
                                  mode: "reject-incoming",
                                })
                              }
                            >
                              거절
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {/* 공유 중 — 양방향 동일 포맷. 부가 라벨(보는 중/공유 중) 제거하고
                  같은 사용자 한 번만 표시 (양쪽 다 accepted 일 때 dedupe). */}
              {(() => {
                type AccItem = { id: string; userId: string; name: string };
                const seen = new Set<string>();
                const items: AccItem[] = [];
                for (const s of incomingAccepted) {
                  const u = getUser(s.owner_id);
                  if (!u || seen.has(u.id)) continue;
                  seen.add(u.id);
                  items.push({ id: s.id, userId: u.id, name: u.name });
                }
                for (const s of outgoingAccepted) {
                  const u = getUser(s.viewer_id);
                  if (!u || seen.has(u.id)) continue;
                  seen.add(u.id);
                  items.push({ id: s.id, userId: u.id, name: u.name });
                }
                if (items.length === 0) return null;
                return (
                  <section>
                    <SectionHeader title="공유 중" count={items.length} />
                    <ul className="flex flex-col gap-2">
                      {items.map((it) => {
                        const u = getUser(it.userId);
                        if (!u) return null;
                        return (
                          <li
                            key={it.userId}
                            className="flex items-center gap-3 rounded-xl border bg-card p-3"
                          >
                            <Avatar user={u} />
                            <span className="flex-1 text-sm font-semibold truncate">
                              {it.name}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 px-3 text-xs text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() =>
                                setCancelTarget({
                                  id: it.id,
                                  name: it.name,
                                  mode: "remove-accepted",
                                })
                              }
                            >
                              해제
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })()}

              {/* 보낸 요청 (대기) */}
              {outgoingPending.length > 0 && (
                <section>
                  <SectionHeader title="보낸 요청" count={outgoingPending.length} />
                  <ul className="flex flex-col gap-2">
                    {outgoingPending.map((s) => {
                      const viewer = getUser(s.viewer_id);
                      if (!viewer) return null;
                      return (
                        <li
                          key={s.id}
                          className="flex items-center gap-3 rounded-xl border bg-card p-3"
                        >
                          <Avatar user={viewer} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {viewer.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              응답 대기 중
                            </p>
                          </div>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() =>
                              setCancelTarget({
                                id: s.id,
                                name: viewer.name,
                                mode: "cancel-outgoing",
                              })
                            }
                            aria-label="초대 취소"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {/* 초대 가능 — 항상 노출 */}
              <section>
                <SectionHeader title="초대 가능" count={invitable.length} />
                {invitable.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {others.length === 0 ? "다른 사용자가 없어요" : "이미 모두 초대했어요"}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {invitable.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center gap-3 rounded-xl border bg-card p-3"
                      >
                        <Avatar user={u} />
                        <span className="flex-1 text-sm font-semibold truncate">
                          {u.name}
                        </span>
                        <Button
                          size="sm"
                          className="h-9 px-3 text-xs shrink-0"
                          onClick={() => handleInvite(u.id)}
                        >
                          <UserPlus className="mr-1 h-3.5 w-3.5" />
                          초대
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
      </div>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => {
          if (!o) setCancelTarget(null);
        }}
        title={confirmTitle}
        description={confirmDesc}
        confirmLabel={confirmLabel}
        destructive
        // ShareManager Dialog 위에 떠야 하므로 z 올림
        contentClassName="z-[80]"
        onConfirm={async () => {
          if (!cancelTarget) return;
          if (cancelTarget.mode === "reject-incoming") {
            await reject(cancelTarget.id);
          } else {
            await cancel(cancelTarget.id);
          }
          setCancelTarget(null);
        }}
      />
    </PanelDialog>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Users className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground break-keep">{text}</p>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, X, Clock, Check, Users } from "lucide-react";
import { useCalendarShares } from "@/hooks/use-calendar-shares";
import { useAppUsers, useCurrentUserId } from "@/lib/current-user";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabKey = "incoming" | "outgoing" | "invite";

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
        <img
          src={user.avatar_url}
          alt={user.name}
          className="h-full w-full object-cover"
        />
      ) : (
        user.emoji || user.name[0]
      )}
    </span>
  );
}

function StatusDot({ status }: { status: "pending" | "accepted" | "rejected" }) {
  const cfg = {
    pending: { label: "대기", cls: "text-amber-600 bg-amber-50", icon: Clock },
    accepted: { label: "수락", cls: "text-green-600 bg-green-50", icon: Check },
    rejected: { label: "거절", cls: "text-red-600 bg-red-50", icon: X },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

export default function ShareManager({ open, onOpenChange }: Props) {
  const { users } = useAppUsers();
  const currentUserId = useCurrentUserId();
  const { outgoing, incoming, invite, accept, reject, cancel } =
    useCalendarShares();
  const [tab, setTab] = useState<TabKey>("incoming");

  const getUser = (id: string) => users.find((u) => u.id === id);
  const others = users.filter((u) => u.id !== currentUserId);
  const invitable = others.filter(
    (u) => !outgoing.find((s) => s.viewer_id === u.id)
  );
  const pendingIncoming = incoming.filter((s) => s.status === "pending").length;

  const handleInvite = async (viewerId: string) => {
    const { error } = await invite(viewerId);
    if (error === "already invited") toast.info("이미 초대했습니다");
    else if (error) toast.error("초대 실패");
    else toast.success("초대를 보냈습니다");
  };

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "incoming", label: "받음", badge: pendingIncoming || undefined },
    { key: "outgoing", label: "보냄", badge: outgoing.length || undefined },
    { key: "invite", label: "초대", badge: invitable.length || undefined },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">캘린더 공유</DialogTitle>
        </DialogHeader>

        {/* 탭 */}
        <div className="flex border-b px-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {t.label}
                {t.badge !== undefined && t.badge > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-bold text-primary">
                    {t.badge}
                  </span>
                )}
              </span>
              {tab === t.key && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* 콘텐츠 영역 */}
        <div className="max-h-[60vh] min-h-[240px] overflow-y-auto px-4 py-3">
          {tab === "incoming" && (
            incoming.length === 0 ? (
              <EmptyState text="받은 공유 제안이 없어요" />
            ) : (
              <ul className="flex flex-col gap-2">
                {incoming.map((s) => {
                  const owner = getUser(s.owner_id);
                  if (!owner) return null;
                  return (
                    <li key={s.id} className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
                      <Avatar user={owner} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{owner.name}</p>
                        <StatusDot status={s.status as "pending" | "accepted" | "rejected"} />
                      </div>
                      {s.status === "pending" ? (
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" className="h-8 px-3" onClick={() => accept(s.id)}>
                            수락
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => reject(s.id)}>
                            거절
                          </Button>
                        </div>
                      ) : s.status === "accepted" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={async () => {
                            if (confirm("공유 연결을 해제할까요?")) await cancel(s.id);
                          }}
                        >
                          해제
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {tab === "outgoing" && (
            outgoing.length === 0 ? (
              <EmptyState text="아직 보낸 공유가 없어요" />
            ) : (
              <ul className="flex flex-col gap-2">
                {outgoing.map((s) => {
                  const viewer = getUser(s.viewer_id);
                  if (!viewer) return null;
                  return (
                    <li key={s.id} className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
                      <Avatar user={viewer} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{viewer.name}</p>
                        <StatusDot status={s.status as "pending" | "accepted" | "rejected"} />
                      </div>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={async () => {
                          if (confirm(`${viewer.name}님 공유를 취소할까요?`)) await cancel(s.id);
                        }}
                        aria-label="공유 취소"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {tab === "invite" && (
            invitable.length === 0 ? (
              <EmptyState text={others.length === 0 ? "다른 사용자가 없어요" : "이미 모두 초대했어요"} />
            ) : (
              <ul className="flex flex-col gap-2">
                {invitable.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
                    <Avatar user={u} />
                    <span className="flex-1 text-sm font-semibold truncate">{u.name}</span>
                    <Button
                      size="sm"
                      className="h-8 px-3 shrink-0"
                      onClick={() => handleInvite(u.id)}
                    >
                      <UserPlus className="mr-1 h-3.5 w-3.5" />
                      초대
                    </Button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Users className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

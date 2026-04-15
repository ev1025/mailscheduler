"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, X, Clock, Check, Inbox, Send, Users } from "lucide-react";
import { useCalendarShares } from "@/hooks/use-calendar-shares";
import { useAppUsers, useCurrentUserId } from "@/lib/current-user";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Avatar({
  user,
  size = 10,
}: {
  user: { emoji: string | null; avatar_url: string | null; name: string; color: string };
  size?: number;
}) {
  return (
    <span
      className="flex items-center justify-center rounded-full text-base shrink-0 overflow-hidden ring-2 ring-background"
      style={
        user.avatar_url
          ? { width: size * 4, height: size * 4, backgroundColor: "transparent" }
          : {
              width: size * 4,
              height: size * 4,
              backgroundColor: user.color + "30",
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

function StatusBadge({ kind }: { kind: "pending" | "accepted" | "rejected" }) {
  const cfg = {
    pending: {
      label: "대기 중",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
      icon: <Clock className="h-3 w-3" />,
    },
    accepted: {
      label: "수락됨",
      cls: "bg-green-100 text-green-700 border-green-200",
      icon: <Check className="h-3 w-3" />,
    },
    rejected: {
      label: "거절됨",
      cls: "bg-red-100 text-red-700 border-red-200",
      icon: <X className="h-3 w-3" />,
    },
  }[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        {typeof count === "number" && count > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary">
            {count}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 pl-8">{children}</div>
    </section>
  );
}

export default function ShareManager({ open, onOpenChange }: Props) {
  const { users } = useAppUsers();
  const currentUserId = useCurrentUserId();
  const { outgoing, incoming, invite, accept, reject, cancel } =
    useCalendarShares();

  const getUser = (id: string) => users.find((u) => u.id === id);
  const others = users.filter((u) => u.id !== currentUserId);
  const invitable = others.filter(
    (u) => !outgoing.find((s) => s.viewer_id === u.id)
  );

  const handleInvite = async (viewerId: string) => {
    const { error } = await invite(viewerId);
    if (error === "already invited") {
      toast.info("이미 초대했습니다");
    } else if (error) {
      toast.error("초대 실패");
    }
  };

  const hasIncoming = incoming.length > 0;
  const hasOutgoing = outgoing.length > 0;
  const hasInvitable = invitable.length > 0;
  const isEmpty = !hasIncoming && !hasOutgoing && !hasInvitable;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] min-h-[50vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>캘린더 공유</DialogTitle>
        </DialogHeader>

        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">아직 공유할 사람이 없어요</p>
              <p className="text-xs text-muted-foreground max-w-[240px]">
                다른 사람이 이 앱에 가입하면 여기서 내 캘린더를 공유하거나
                상대 캘린더를 초대받을 수 있어요.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* 받은 초대 */}
            {hasIncoming && (
              <Section
                icon={<Inbox className="h-3.5 w-3.5" />}
                title="받은 공유 제안"
                count={incoming.filter((s) => s.status === "pending").length}
              >
                {incoming.map((s) => {
                  const owner = getUser(s.owner_id);
                  if (!owner) return null;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
                    >
                      <Avatar user={owner} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {owner.name}
                        </p>
                        <div className="mt-1">
                          <StatusBadge
                            kind={
                              s.status === "pending"
                                ? "pending"
                                : s.status === "accepted"
                                  ? "accepted"
                                  : "rejected"
                            }
                          />
                        </div>
                      </div>
                      {s.status === "pending" && (
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={async () => {
                              await accept(s.id);
                            }}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> 수락
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={async () => {
                              await reject(s.id);
                            }}
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> 거절
                          </Button>
                        </div>
                      )}
                      {s.status === "accepted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0"
                          onClick={async () => {
                            if (confirm("공유 연결을 해제할까요?")) {
                              await cancel(s.id);
                            }
                          }}
                        >
                          해제
                        </Button>
                      )}
                    </div>
                  );
                })}
              </Section>
            )}

            {/* 내가 보낸 공유 */}
            {hasOutgoing && (
              <Section
                icon={<Send className="h-3.5 w-3.5" />}
                title="내가 공유한 사람"
                count={outgoing.length}
              >
                {outgoing.map((s) => {
                  const viewer = getUser(s.viewer_id);
                  if (!viewer) return null;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
                    >
                      <Avatar user={viewer} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {viewer.name}
                        </p>
                        <div className="mt-1">
                          <StatusBadge
                            kind={
                              s.status === "pending"
                                ? "pending"
                                : s.status === "accepted"
                                  ? "accepted"
                                  : "rejected"
                            }
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0"
                        onClick={async () => {
                          if (
                            confirm(`${viewer.name}님에게 공유를 취소할까요?`)
                          ) {
                            await cancel(s.id);
                          }
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </Section>
            )}

            {/* 초대 가능한 사용자 */}
            {hasInvitable && (
              <Section
                icon={<UserPlus className="h-3.5 w-3.5" />}
                title="초대 가능한 사용자"
                count={invitable.length}
              >
                {invitable.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3"
                  >
                    <Avatar user={u} />
                    <span className="flex-1 text-sm font-semibold truncate">
                      {u.name}
                    </span>
                    <Button
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => handleInvite(u.id)}
                    >
                      <UserPlus className="mr-1 h-3.5 w-3.5" /> 초대
                    </Button>
                  </div>
                ))}
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

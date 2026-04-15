"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, X, Clock, Check } from "lucide-react";
import { useCalendarShares } from "@/hooks/use-calendar-shares";
import { useAppUsers, useCurrentUserId } from "@/lib/current-user";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Avatar({
  user,
  size = 8,
}: {
  user: { emoji: string | null; avatar_url: string | null; name: string; color: string };
  size?: number;
}) {
  const cls = `h-${size} w-${size}`;
  return (
    <span
      className={`${cls} flex items-center justify-center rounded-full text-sm shrink-0 overflow-hidden`}
      style={
        user.avatar_url
          ? { backgroundColor: "transparent" }
          : { backgroundColor: user.color + "30", color: user.color }
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

export default function ShareManager({ open, onOpenChange }: Props) {
  const { users } = useAppUsers();
  const currentUserId = useCurrentUserId();
  const { outgoing, incoming, invite, accept, reject, cancel } =
    useCalendarShares();

  const getUser = (id: string) => users.find((u) => u.id === id);

  const others = users.filter((u) => u.id !== currentUserId);

  const handleInvite = async (viewerId: string) => {
    const { error } = await invite(viewerId);
    if (error === "already invited") {
      toast.info("이미 초대했습니다");
    } else if (error) {
      toast.error("초대 실패");
    } else {
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>캘린더 공유</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {/* 받은 초대 */}
          {incoming.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground">
                📥 받은 공유 제안
              </h3>
              {incoming.map((s) => {
                const owner = getUser(s.owner_id);
                if (!owner) return null;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-lg border p-2.5"
                  >
                    <Avatar user={owner} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{owner.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.status === "pending"
                          ? "캘린더를 공유하려고 해요"
                          : s.status === "accepted"
                            ? "수락됨 — 캘린더에 표시 중"
                            : "거절됨"}
                      </p>
                    </div>
                    {s.status === "pending" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={async () => {
                            await accept(s.id);
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={async () => {
                            await reject(s.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {s.status === "accepted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
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
            </section>
          )}

          {/* 내가 보낸 공유 */}
          {outgoing.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground">
                📤 내가 공유한 사람
              </h3>
              {outgoing.map((s) => {
                const viewer = getUser(s.viewer_id);
                if (!viewer) return null;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-lg border p-2.5"
                  >
                    <Avatar user={viewer} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{viewer.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {s.status === "pending" && (
                          <>
                            <Clock className="h-3 w-3" /> 수락 대기 중
                          </>
                        )}
                        {s.status === "accepted" && (
                          <>
                            <Check className="h-3 w-3 text-green-500" /> 수락됨
                          </>
                        )}
                        {s.status === "rejected" && <>거절됨</>}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={async () => {
                        if (confirm(`${viewer.name}님에게 공유를 취소할까요?`)) {
                          await cancel(s.id);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </section>
          )}

          {/* 새로 공유할 사람 */}
          <section className="flex flex-col gap-2">
            {others.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                공유할 수 있는 다른 사용자가 없습니다
              </p>
            ) : (
              others
                .filter(
                  (u) => !outgoing.find((s) => s.viewer_id === u.id)
                )
                .map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-2 rounded-lg border p-2.5"
                  >
                    <Avatar user={u} />
                    <span className="flex-1 text-sm font-medium">{u.name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleInvite(u.id)}
                    >
                      <UserPlus className="mr-1 h-3 w-3" />
                      초대
                    </Button>
                  </div>
                ))
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

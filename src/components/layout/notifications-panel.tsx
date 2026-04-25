"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { useCalendarShares } from "@/hooks/use-calendar-shares";
import { useAppUsers } from "@/lib/current-user";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NotificationsPanel({ open, onOpenChange }: Props) {
  const { notifications, unreadCount, markAsRead, markAllRead, refetch } =
    useNotifications();
  const { users } = useAppUsers();
  const { incoming, accept, reject } = useCalendarShares();

  const getActor = (id: string | null) => users.find((u) => u.id === id);

  const handleAcceptCalendarShare = async (
    actorId: string | null,
    notificationId: string
  ) => {
    const pending = incoming.find(
      (s) => s.owner_id === actorId && s.status === "pending"
    );
    if (!pending) {
      toast.error("공유 요청을 찾을 수 없습니다 (이미 처리됐을 수 있어요)");
      await markAsRead(notificationId);
      return;
    }
    await accept(pending.id);
    await markAsRead(notificationId);
    await refetch();
  };

  const handleRejectCalendarShare = async (
    actorId: string | null,
    notificationId: string
  ) => {
    const pending = incoming.find(
      (s) => s.owner_id === actorId && s.status === "pending"
    );
    if (pending) await reject(pending.id);
    await markAsRead(notificationId);
    await refetch();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showBackButton={false}
        // 모바일 좌우 1rem 인셋, 데스크톱 max-w-md. 본문 자체 스크롤만 허용 — 헤더는 고정.
        className="max-w-md p-0 gap-0 max-h-[80dvh] overflow-hidden grid-rows-[auto_1fr]"
      >
        {/* 헤더 — 좌측 ← 닫기, 가운데 제목, 우측 모두 읽음 액션 */}
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="뒤로"
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <DialogTitle className="text-[17px] font-semibold leading-none flex-1 min-w-0">
            알림
          </DialogTitle>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              className="h-8 text-xs shrink-0"
            >
              모두 읽음
            </Button>
          )}
        </div>

        {/* 본문 — 자체 스크롤 */}
        <div className="overflow-y-auto p-3">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              알림이 없습니다
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {notifications.map((n) => {
                const actor = getActor(n.actor_id);
                const isShareRequest = n.type === "calendar_share_request";
                const timeAgo = formatDistanceToNow(new Date(n.created_at), {
                  addSuffix: true,
                  locale: ko,
                });
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                      !n.read ? "bg-primary/5 border-primary/30" : "hover:bg-accent/30"
                    }`}
                  >
                    {actor ? (
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-full text-sm shrink-0 overflow-hidden"
                        style={
                          actor.avatar_url
                            ? { backgroundColor: "transparent" }
                            : {
                                backgroundColor: actor.color + "30",
                                color: actor.color,
                              }
                        }
                      >
                        {actor.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={actor.avatar_url}
                            alt={actor.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          actor.emoji || actor.name[0]
                        )}
                      </span>
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm shrink-0">
                        📢
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug break-keep flex-1 min-w-0">
                          {n.title}
                        </p>
                        <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap shrink-0 mt-0.5">
                          {timeAgo}
                        </span>
                      </div>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed break-keep">
                          {n.body}
                        </p>
                      )}
                      {isShareRequest && !n.read ? (
                        <div className="mt-2.5 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleAcceptCalendarShare(n.actor_id, n.id)
                            }
                            className="h-9 sm:h-8 text-xs flex-1 sm:flex-none sm:min-w-[72px]"
                          >
                            <Check className="mr-1 h-3.5 w-3.5" /> 수락
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleRejectCalendarShare(n.actor_id, n.id)
                            }
                            className="h-9 sm:h-8 text-xs flex-1 sm:flex-none sm:min-w-[72px]"
                          >
                            <X className="mr-1 h-3.5 w-3.5" /> 거절
                          </Button>
                        </div>
                      ) : !n.read ? (
                        <button
                          type="button"
                          onClick={() => markAsRead(n.id)}
                          className="mt-1.5 text-[11px] text-primary hover:underline"
                        >
                          읽음으로 표시
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { useCalendarShares } from "@/hooks/use-calendar-shares";
import { useAppUsers } from "@/lib/current-user";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, X } from "lucide-react";
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
    // 알림의 actor_id(소유자)가 보낸 공유 요청을 찾아서 수락
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
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>알림</DialogTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                className="text-xs h-7"
              >
                모두 읽음
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              알림이 없습니다
            </p>
          ) : (
            notifications.map((n) => {
              const actor = getActor(n.actor_id);
              const isShareRequest = n.type === "calendar_share_request";
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    !n.read ? "bg-primary/5 border-primary/30" : ""
                  }`}
                >
                  {actor ? (
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-sm shrink-0 overflow-hidden"
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
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm shrink-0">
                      📢
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </p>
                    {isShareRequest && !n.read && (
                      <div className="mt-2 flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleAcceptCalendarShare(n.actor_id, n.id)
                          }
                          className="h-7 text-xs"
                        >
                          <Check className="mr-1 h-3 w-3" /> 수락
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleRejectCalendarShare(n.actor_id, n.id)
                          }
                          className="h-7 text-xs"
                        >
                          <X className="mr-1 h-3 w-3" /> 거절
                        </Button>
                      </div>
                    )}
                  </div>
                  {!n.read && !isShareRequest && (
                    <button
                      type="button"
                      onClick={() => markAsRead(n.id)}
                      className="text-[10px] text-primary mt-1 shrink-0"
                    >
                      읽음
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

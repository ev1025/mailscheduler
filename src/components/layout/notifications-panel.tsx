"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { useAppUsers } from "@/lib/current-user";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NotificationsPanel({ open, onOpenChange }: Props) {
  const { notifications, unreadCount, markAsRead, markAllRead } =
    useNotifications();
  const { users } = useAppUsers();

  const getActor = (id: string | null) => users.find((u) => u.id === id);

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
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markAsRead(n.id)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 ${
                    !n.read ? "bg-primary/5 border-primary/30" : ""
                  }`}
                >
                  {actor ? (
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-sm shrink-0"
                      style={{
                        backgroundColor: actor.color + "30",
                        color: actor.color,
                      }}
                    >
                      {actor.emoji || actor.name[0]}
                    </span>
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm shrink-0">
                      📢
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                        locale: ko,
                      })}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
import { supabase } from "@/lib/supabase";
import { useCurrentUserId } from "@/lib/current-user";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function extractEventId(link: string | null): string | null {
  if (!link) return null;
  const match = link.match(/accept=([a-f0-9-]+)/i);
  return match ? match[1] : null;
}

export default function NotificationsPanel({ open, onOpenChange }: Props) {
  const { notifications, unreadCount, markAsRead, markAllRead, refetch } =
    useNotifications();
  const { users } = useAppUsers();
  const currentUserId = useCurrentUserId();

  const getActor = (id: string | null) => users.find((u) => u.id === id);

  const handleAccept = async (eventId: string, notificationId: string) => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from("calendar_events")
      .select("shared_accepted_by, user_id")
      .eq("id", eventId)
      .single();
    if (!data) {
      toast.error("일정을 찾을 수 없습니다 (삭제됨)");
      await markAsRead(notificationId);
      return;
    }
    const existing = (data.shared_accepted_by as string[] | null) || [];
    if (!existing.includes(currentUserId)) {
      await supabase
        .from("calendar_events")
        .update({ shared_accepted_by: [...existing, currentUserId] })
        .eq("id", eventId);
    }
    await markAsRead(notificationId);
    await refetch();
    toast.success("공유 수락됨 — 캘린더에 표시됩니다");
  };

  const handleReject = async (eventId: string, notificationId: string) => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from("calendar_events")
      .select("shared_with")
      .eq("id", eventId)
      .single();
    if (data) {
      const existing = (data.shared_with as string[] | null) || [];
      const next = existing.filter((id) => id !== currentUserId);
      await supabase
        .from("calendar_events")
        .update({ shared_with: next.length > 0 ? next : null })
        .eq("id", eventId);
    }
    await markAsRead(notificationId);
    await refetch();
    toast.success("공유 거절됨");
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
              const isShareRequest = n.type === "event_share_request";
              const eventId = isShareRequest ? extractEventId(n.link) : null;

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
                    {isShareRequest && eventId && !n.read && (
                      <div className="mt-2 flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => handleAccept(eventId, n.id)}
                          className="h-7 text-xs"
                        >
                          <Check className="mr-1 h-3 w-3" /> 수락
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(eventId, n.id)}
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

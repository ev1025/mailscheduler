"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Wallet,
  StickyNote,
  ShoppingBag,
  BookOpen,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/current-user";

const navItems = [
  { href: "/calendar", label: "캘린더", icon: Calendar },
  { href: "/finance", label: "가계부", icon: Wallet },
  { href: "/memo", label: "메모", icon: StickyNote },
  { href: "/products", label: "생필품", icon: ShoppingBag },
  { href: "/knowledge", label: "지식", icon: BookOpen },
];

export default function BottomNav() {
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const profileActive = pathname === "/profile" || pathname.startsWith("/profile/");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-lg md:hidden pb-safe">
      <div className="flex h-14 items-stretch justify-around">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs transition-colors active:bg-accent/50",
                isActive
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              <item.icon
                className={cn("h-5 w-5", isActive && "stroke-[2.5]")}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Link
          href="/profile"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs transition-colors active:bg-accent/50",
            profileActive ? "text-foreground font-medium" : "text-muted-foreground"
          )}
        >
          {currentUser ? (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-xs overflow-hidden"
              style={
                currentUser.avatar_url
                  ? { backgroundColor: "transparent" }
                  : {
                      backgroundColor: currentUser.color + "30",
                      color: currentUser.color,
                    }
              }
            >
              {currentUser.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                currentUser.emoji || currentUser.name[0]
              )}
            </span>
          ) : (
            <User className="h-5 w-5" />
          )}
          <span>프로필</span>
        </Link>
      </div>
    </nav>
  );
}

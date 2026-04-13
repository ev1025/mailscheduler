"use client";

import { useState } from "react";
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
import UserSwitcher from "./user-switcher";
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
  const [userOpen, setUserOpen] = useState(false);
  const currentUser = useCurrentUser();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-lg md:hidden">
      <div className="flex h-14 items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] transition-colors",
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
        <button
          type="button"
          onClick={() => setUserOpen(true)}
          className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] text-muted-foreground"
        >
          {currentUser ? (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-xs"
              style={{
                backgroundColor: currentUser.color + "30",
                color: currentUser.color,
              }}
            >
              {currentUser.emoji || currentUser.name[0]}
            </span>
          ) : (
            <User className="h-5 w-5" />
          )}
          <span>프로필</span>
        </button>
      </div>
      <UserSwitcher open={userOpen} onOpenChange={setUserOpen} />
    </nav>
  );
}

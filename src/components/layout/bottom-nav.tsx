"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Wallet, StickyNote, Pill } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/calendar", label: "캘린더", icon: Calendar },
  { href: "/finance", label: "가계부", icon: Wallet },
  { href: "/memo", label: "메모", icon: StickyNote },
  { href: "/supplements", label: "영양제", icon: Pill },
];

export default function BottomNav() {
  const pathname = usePathname();

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
                "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition-colors",
                isActive
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-config";

// On phones the sidebar collapses into a bottom tab bar. Padding-bottom adds
// the device's safe-area inset so the bar (and its tap targets) sit clear of
// the home indicator on notched iPhones instead of touching the very edge.
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="border-border bg-background/90 fixed inset-x-0 bottom-0 z-10 flex items-stretch border-t backdrop-blur-sm md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {navItems.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-16 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-[10.5px] leading-none font-medium whitespace-nowrap transition-colors active:opacity-70",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

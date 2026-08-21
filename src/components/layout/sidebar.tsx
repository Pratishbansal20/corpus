"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/money";
import type { NetWorth } from "@/lib/networth/compute";
import type { PricingStatus } from "@/lib/pricing/queries";
import { navItems } from "./nav-config";
import { Wordmark } from "./wordmark";

type ShellData = { netWorth: NetWorth; pricingStatus: PricingStatus };

// The nav, wordmark and layout render the instant this mounts: nothing here
// depends on `dataPromise`. Only the two small pieces below that actually
// need it (the net-worth figure, the sync label) suspend on their own, each
// in its own boundary, so a slow query never blocks the parts of the sidebar
// that don't need it.
export function Sidebar({
  dataPromise,
}: {
  dataPromise: Promise<ShellData>;
}) {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar border-border hidden w-[15.5rem] shrink-0 flex-col border-r md:flex">
      <div className="flex h-16 items-center px-5">
        <Wordmark />
      </div>

      {/* The number you opened the app for, on every page. */}
      <div className="border-border mx-5 border-t py-5">
        <p className="eyebrow">Net worth</p>
        <Suspense
          fallback={
            <div className="skeleton mt-1.5 h-[1.75rem] w-32 rounded-md" />
          }
        >
          <NetWorthFigure dataPromise={dataPromise} />
        </Suspense>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 pt-1">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-md py-2 pr-3 pl-4 text-sm transition-colors",
                active
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              {/* Brass rail marks position: a lit indicator, not a filled pill. */}
              <span
                aria-hidden
                className={cn(
                  "bg-primary absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-full transition-all",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
              <Icon
                className={cn(
                  "size-[1.15rem] shrink-0 transition-colors",
                  active ? "text-primary" : "",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-border text-muted-foreground border-t px-5 py-4 text-xs">
        <Suspense fallback={<div className="skeleton h-3 w-28 rounded" />}>
          <SyncLabel dataPromise={dataPromise} />
        </Suspense>
      </div>
    </aside>
  );
}

function NetWorthFigure({ dataPromise }: { dataPromise: Promise<ShellData> }) {
  const { netWorth } = use(dataPromise);
  return (
    <p className="font-display mt-1.5 text-[1.75rem] leading-none font-semibold tracking-[-0.02em] tabular-nums">
      {formatInr(netWorth.netWorthInr)}
    </p>
  );
}

function SyncLabel({ dataPromise }: { dataPromise: Promise<ShellData> }) {
  const { pricingStatus } = use(dataPromise);
  return <>{pricingStatus.label}</>;
}

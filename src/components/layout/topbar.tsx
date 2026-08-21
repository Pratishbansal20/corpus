import { Suspense, use } from "react";
import { RefreshPricesButton } from "./refresh-prices-button";
import { UserMenu } from "./user-menu";
import { WordmarkGlyph } from "./wordmark";
import { navItems } from "./nav-config";
import type { NetWorth } from "@/lib/networth/compute";
import type { PricingStatus } from "@/lib/pricing/queries";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type ShellData = { netWorth: NetWorth; pricingStatus: PricingStatus };

function currentTitle(pathname: string): string {
  const match = navItems.find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );
  return match?.label ?? "Corpus";
}

export function Topbar({
  user,
  dataPromise,
  pathname,
}: {
  user: SessionUser;
  dataPromise: Promise<ShellData>;
  pathname: string;
}) {
  return (
    <header className="border-border bg-background/70 sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b px-5 backdrop-blur-md md:px-8">
      <div className="flex min-w-0 items-center gap-2.5">
        {/* The mark stands in for the sidebar on phones. */}
        <WordmarkGlyph className="size-[1.15rem] shrink-0 md:hidden" />
        <h1 className="font-display truncate text-[1.0625rem] font-semibold tracking-[-0.01em]">
          {currentTitle(pathname)}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <Suspense
          fallback={<div className="skeleton h-8 w-40 rounded-lg" />}
        >
          <PricingPill dataPromise={dataPromise} />
        </Suspense>
        <UserMenu user={user} />
      </div>
    </header>
  );
}

function PricingPill({ dataPromise }: { dataPromise: Promise<ShellData> }) {
  const { pricingStatus } = use(dataPromise);
  return <RefreshPricesButton status={pricingStatus} />;
}

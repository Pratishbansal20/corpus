"use client";

import { usePathname } from "next/navigation";
import { Topbar as TopbarInner } from "./topbar";
import type { NetWorth } from "@/lib/networth/compute";
import type { PricingStatus } from "@/lib/pricing/queries";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type ShellData = { netWorth: NetWorth; pricingStatus: PricingStatus };

export function TopbarShell({
  user,
  dataPromise,
}: {
  user: SessionUser;
  dataPromise: Promise<ShellData>;
}) {
  const pathname = usePathname();
  return (
    <TopbarInner user={user} dataPromise={dataPromise} pathname={pathname} />
  );
}

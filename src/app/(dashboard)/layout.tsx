import { Sidebar } from "@/components/layout/sidebar";
import { TopbarShell } from "@/components/layout/topbar-shell";
import { MobileNav } from "@/components/layout/mobile-nav";
import { requireUnlocked } from "@/lib/auth/require-user";
import { getPricingStatus } from "@/lib/pricing/queries";
import { getNetWorthTotals } from "@/lib/networth/queries";

// Shared chrome for every authenticated app page: sidebar (desktop),
// top bar, and a bottom tab bar (mobile). requireUnlocked() gates the entire
// group: any unauthenticated request is redirected to /login, and any
// locked session is redirected to /unlock before children render.
//
// The net-worth readout and sync label are deliberately *not* awaited here.
// This layout wraps every dashboard page, so if it blocked on their data, a
// nav click would sit frozen (nothing streams, not even a page's own
// loading.tsx) until both queries returned, no matter how fast the target
// page itself was. Instead the promise is started once, here, and handed
// down un-awaited: Sidebar and TopbarShell each suspend on their own small
// slice of it, so the nav, wordmark and page content all paint immediately
// and only the net-worth figure and the sync pill show a brief shimmer.
// requireUnlocked() stays awaited above this: it is the security gate, and
// nothing should stream before it resolves.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUnlocked();

  const shellDataPromise = Promise.all([
    getNetWorthTotals(user.id!),
    getPricingStatus(user.id!),
  ]).then(([netWorth, pricingStatus]) => ({ netWorth, pricingStatus }));

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar dataPromise={shellDataPromise} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopbarShell user={user} dataPromise={shellDataPromise} />
        {/* Bottom padding clears the fixed mobile nav plus its safe-area
            inset (notched iPhones); md+ drops back to a plain pb-14. */}
        <main className="flex-1 px-5 pt-7 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-9 md:pb-14">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

import { Sidebar } from "@/components/layout/sidebar";
import { TopbarShell } from "@/components/layout/topbar-shell";
import { MobileNav } from "@/components/layout/mobile-nav";
import { requireUnlocked } from "@/lib/auth/require-user";
import { getPricingStatus } from "@/lib/pricing/queries";

// Shared chrome for every authenticated app page: sidebar (desktop),
// top bar, and a bottom tab bar (mobile). requireUnlocked() gates the entire
// group — any unauthenticated request is redirected to /login, and any
// unlocked session is redirected to /unlock before children render.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUnlocked();
  const pricingStatus = await getPricingStatus(user.id!);

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopbarShell user={user} pricingStatus={pricingStatus} />
        {/* Bottom padding clears the fixed mobile nav plus its safe-area
            inset (notched iPhones); md+ drops back to a plain pb-10. */}
        <main className="flex-1 px-5 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pb-10">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

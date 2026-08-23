import { MarkCard } from "@/lib/mark";

// Served by the service worker when a navigation fails with no network
// (see public/sw.js). Deliberately static and self-contained: it has to
// render from the one thing the service worker precaches, with no DB call
// and no auth check, since the whole point is that the network is down.
export default function OfflinePage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        className="rounded-[7px]"
      >
        <MarkCard />
      </svg>
      <div>
        <p className="font-display text-lg font-semibold">You&apos;re offline</p>
        <p className="text-muted-foreground mt-1 max-w-xs text-sm text-balance">
          Corpus needs a connection to reach your data. Reconnect and try
          again.
        </p>
      </div>
    </div>
  );
}

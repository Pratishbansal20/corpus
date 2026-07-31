import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { refreshPortfolioPrices } from "@/lib/portfolio/refresh";
import { refreshFundHoldings } from "@/lib/funds/refresh";
import { writeDailyNetWorthSnapshot } from "@/lib/networth/snapshot";

// Uses the pg adapter (Node): must not run on the edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily job (Vercel Cron): refresh live prices/FX, then record a net-worth
 * snapshot for every user. Protected by CRON_SECRET: Vercel Cron sends it as
 * `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const result = await refreshPortfolioPrices();

  // Refresh mutual-fund constituents (graceful: keeps previous on failure).
  const funds = await refreshFundHoldings();

  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    await writeDailyNetWorthSnapshot(u.id);
  }

  return NextResponse.json({
    ok: result.ok,
    pricesUpdated: result.pricesUpdated,
    fxUpdated: result.fxUpdated,
    fundsUpdated: funds.updated,
    fundsFailed: funds.failed,
    snapshots: users.length,
    errors: result.errors,
    refreshedAt: result.refreshedAt,
  });
}

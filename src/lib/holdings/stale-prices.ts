import type { InstrumentType } from "@/generated/prisma";

/**
 * Catching a holding that has quietly stopped pricing.
 *
 * This exists because five instruments sat on their seeded price for six weeks
 * without anyone noticing. A wrong symbol does not throw: Yahoo answers 404,
 * the provider returns null, the refresh counts it as "skipped", and the
 * position keeps showing its cost basis as though that were its value. The same
 * silence hid a dead AMFI URL for months.
 *
 * The naive test, "no price in the last N days", is the wrong shape. Markets
 * close for weekends and holidays, so every long weekend would cry wolf, and N
 * would have to be set so high that a genuinely dead symbol takes a fortnight
 * to surface. Instead each instrument is judged against its own peers, which
 * self-adjusts for whatever the calendar is doing.
 *
 * Two failure modes, two checks:
 *
 *   LAGGING       one instrument is far behind others of its own type. Its
 *                 peers priced today and it did not, so the calendar is not the
 *                 explanation: the symbol is wrong. This is the five-symbol bug.
 *   SOURCE_DOWN   a whole type is far behind today. Peer comparison cannot see
 *                 this (everything is equally stale), so the group's freshest
 *                 price is also checked against the clock. This is the dead
 *                 AMFI URL, where every fund stopped at once.
 */

/**
 * Days of slack before either check fires.
 *
 * The longest realistic run of non-trading days is a weekend wrapped around
 * consecutive public holidays, which reaches four. Five clears that, tolerates
 * one failed cron run, and still surfaces a broken symbol inside a week rather
 * than the six weeks it actually took. Both checks use it: for LAGGING it is
 * slack against peers, where a healthy instrument is normally within a day, so
 * five is already generous.
 */
export const STALE_PRICE_DAYS = 5;

const DAY_MS = 86_400_000;

export type StaleReason = "LAGGING" | "SOURCE_DOWN" | "NEVER_PRICED";

export type PricedInstrument = {
  instrumentId: string;
  symbol: string;
  name: string;
  type: InstrumentType;
  /** Latest price date, or null if the instrument has never been priced. */
  lastPricedAt: Date | null;
};

export type StaleInstrument = {
  instrumentId: string;
  symbol: string;
  name: string;
  type: InstrumentType;
  lastPricedAt: Date | null;
  reason: StaleReason;
  /** Days behind its peers, or behind today for a down source. */
  daysBehind: number | null;
};

const wholeDaysBetween = (from: number, to: number) =>
  Math.floor((to - from) / DAY_MS);

/**
 * Instruments that look like they have stopped pricing.
 *
 * `now` is injectable so the behaviour is testable without touching the clock.
 */
export function findStalePrices(
  instruments: readonly PricedInstrument[],
  now: Date = new Date(),
  maxLagDays: number = STALE_PRICE_DAYS,
): StaleInstrument[] {
  if (instruments.length === 0) return [];

  // Grouped by type, because each has its own calendar and publishing lag: a
  // fund's NAV lands the evening of the day it applies to, while an equity
  // quote is same-day. Comparing a fund against a stock would flag it daily.
  const byType = new Map<InstrumentType, PricedInstrument[]>();
  for (const inst of instruments) {
    const list = byType.get(inst.type) ?? [];
    list.push(inst);
    byType.set(inst.type, list);
  }

  const stale: StaleInstrument[] = [];
  const nowMs = now.getTime();

  for (const [, group] of byType) {
    const priced = group.filter((i) => i.lastPricedAt !== null);

    // Nothing in this group has ever priced: every one of them is broken, and
    // there is no peer to measure against.
    if (priced.length === 0) {
      for (const inst of group) {
        stale.push({ ...inst, reason: "NEVER_PRICED", daysBehind: null });
      }
      continue;
    }

    const freshestMs = Math.max(
      ...priced.map((i) => i.lastPricedAt!.getTime()),
    );
    const groupBehind = wholeDaysBetween(freshestMs, nowMs);

    // The whole source is down: report the group rather than each member, since
    // the fault is one shared upstream, not the individual symbols.
    if (groupBehind > maxLagDays) {
      for (const inst of group) {
        stale.push({
          ...inst,
          reason: "SOURCE_DOWN",
          daysBehind: inst.lastPricedAt
            ? wholeDaysBetween(inst.lastPricedAt.getTime(), nowMs)
            : null,
        });
      }
      continue;
    }

    for (const inst of group) {
      if (!inst.lastPricedAt) {
        stale.push({ ...inst, reason: "NEVER_PRICED", daysBehind: null });
        continue;
      }
      const behind = wholeDaysBetween(inst.lastPricedAt.getTime(), freshestMs);
      if (behind > maxLagDays) {
        stale.push({ ...inst, reason: "LAGGING", daysBehind: behind });
      }
    }
  }

  return stale.sort((a, b) => (b.daysBehind ?? 1e9) - (a.daysBehind ?? 1e9));
}

/** One line for the dashboard nudge, or null when everything is pricing. */
export function stalePriceMessage(stale: readonly StaleInstrument[]): string | null {
  if (stale.length === 0) return null;

  // A down source is the more serious finding, so it wins the one line we get.
  const sourceDown = stale.filter((s) => s.reason === "SOURCE_DOWN");
  if (sourceDown.length > 0) {
    return `Prices have stopped updating for ${sourceDown.length} holding${
      sourceDown.length > 1 ? "s" : ""
    }. A price source may be down.`;
  }

  const names = stale.slice(0, 3).map((s) => s.symbol).join(", ");
  const rest = stale.length - Math.min(3, stale.length);
  return `${stale.length} holding${stale.length > 1 ? "s are" : " is"} not pricing (${names}${
    rest > 0 ? ` and ${rest} more` : ""
  }). The symbol is probably wrong.`;
}

import { describe, it, expect } from "vitest";
import {
  parseNavHistory,
  resolveAllotmentNav,
  MAX_ALLOTMENT_LAG_DAYS,
} from "./mfapi-nav-history";

// A slice of a real published series. The gaps are the point: 25 and 26 Jul
// 2026 are a Saturday and a Sunday, and 15 Aug is Independence Day with the
// weekend behind it, so no NAV exists on any of them.
const SAMPLE = {
  data: [
    { date: "18-08-2025", nav: "10.50000" },
    { date: "14-08-2025", nav: "10.40000" },
    { date: "13-08-2025", nav: "10.30000" },
    { date: "31-07-2026", nav: "55.83800" },
    { date: "30-07-2026", nav: "55.66100" },
    { date: "27-07-2026", nav: "55.63400" },
    { date: "24-07-2026", nav: "55.10600" },
  ],
};

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

describe("parseNavHistory", () => {
  it("parses DD-MM-YYYY into sorted YYYY-MM-DD keys", () => {
    const h = parseNavHistory("147946", SAMPLE);
    expect(h.dates[0]).toBe("2025-08-13");
    expect(h.dates.at(-1)).toBe("2026-07-31");
    expect(h.navByDate.get("2026-07-31")).toBe(55.838);
  });

  it("drops unusable rows rather than trusting them", () => {
    const h = parseNavHistory("1", {
      data: [
        { date: "31-07-2026", nav: "10.5" },
        { date: "garbage", nav: "10.5" },
        { date: "30-07-2026", nav: "N.A." },
        { date: "29-07-2026", nav: "0" },
        { date: "28-07-2026", nav: "-3" },
      ],
    });
    expect(h.dates).toEqual(["2026-07-31"]);
  });

  it("throws rather than returning an empty history", () => {
    // Silently returning nothing would look like "NAV not published yet" and
    // stall auto-apply forever instead of surfacing a broken source.
    expect(() => parseNavHistory("1", { data: [] })).toThrow(/empty/);
    expect(() => parseNavHistory("1", {})).toThrow(/no data array/);
  });
});

describe("resolveAllotmentNav", () => {
  const history = parseNavHistory("147946", SAMPLE);

  it("uses the same day when the debit lands on a business day", () => {
    const r = resolveAllotmentNav(history, utc(2026, 6, 30));
    expect(r).toMatchObject({ navDate: "2026-07-30", nav: 55.661, lagDays: 0 });
  });

  it("rolls a weekend debit to the next published NAV", () => {
    // 25 Jul 2026 is a Saturday: allotment happens on Monday the 27th.
    const r = resolveAllotmentNav(history, utc(2026, 6, 25));
    expect(r).toMatchObject({ navDate: "2026-07-27", nav: 55.634, lagDays: 2 });
  });

  it("rolls a public holiday to the next published NAV", () => {
    // 15 Aug 2025 is Independence Day and a Friday, so the next NAV is the
    // following Monday. Read off the series, so no holiday list to maintain.
    const r = resolveAllotmentNav(history, utc(2025, 7, 15));
    expect(r).toMatchObject({ navDate: "2025-08-18", nav: 10.5, lagDays: 3 });
  });

  it("waits instead of guessing when the NAV is not published yet", () => {
    // A debit due today, before the evening upload: there is nothing on or
    // after it. Reaching backwards here would buy units at a stale price.
    expect(resolveAllotmentNav(history, utc(2026, 7, 1))).toBeNull();
  });

  it("never reaches backwards for an earlier NAV", () => {
    const r = resolveAllotmentNav(history, utc(2026, 6, 28));
    expect(r?.navDate).toBe("2026-07-30");
    expect(Date.parse(`${r!.navDate}T00:00:00Z`)).toBeGreaterThan(
      utc(2026, 6, 28).getTime() - 1,
    );
  });

  it("refuses a gap too long to be a holiday", () => {
    // 14 Aug 2025 → 31 Jul 2026 in this sample is a reporting hole, not a
    // holiday. Pricing a debit off a NAV a year later would invent a purchase.
    expect(resolveAllotmentNav(history, utc(2025, 7, 19))).toBeNull();
  });

  it("accepts a gap exactly at the limit and rejects one past it", () => {
    const h = parseNavHistory("1", {
      data: [{ date: "20-08-2025", nav: "10" }],
    });
    const atLimit = utc(2025, 7, 20 - MAX_ALLOTMENT_LAG_DAYS);
    const pastLimit = utc(2025, 7, 20 - MAX_ALLOTMENT_LAG_DAYS - 1);
    expect(resolveAllotmentNav(h, atLimit)?.lagDays).toBe(MAX_ALLOTMENT_LAG_DAYS);
    expect(resolveAllotmentNav(h, pastLimit)).toBeNull();
  });
});

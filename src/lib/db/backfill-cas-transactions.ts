// One-off backfill: the CAMS/KFintech CAS at data/cas-raw/cas-2026-09-11.txt
// (gitignored - real PII in the source PDF, none of it needed or reproduced
// here) becomes real Transaction history for the 7 mutual funds it covers.
//
// Run once with: node_modules/.bin/jiti src/lib/db/backfill-cas-transactions.ts
// Idempotent: every inserted row's importRef is derived from the CAS line
// itself, so re-running this is a no-op on rows already written.
//
// Scope, deliberately narrow:
//  - Writes Transaction rows for every real (non-noise) CAS line.
//  - Corrects Holding.quantity/avgBuyPrice for the two funds confirmed to
//    have drifted from reality (Bandhan Small Cap, JioBlackRock Flexi Cap -
//    the CAS is authoritative here per explicit direction: the SipPlan
//    amount was lowered at the broker but never updated in the app, so the
//    cron kept buying phantom extra units against the old, higher amount).
//    The other 5 funds already reconcile exactly and are left untouched.
//  - Adds one OPENING_BALANCE Transaction per non-mutual-fund holding (no
//    source document exists for those in this repo), so every holding has
//    at least one ledger row.
import { PrismaClient, Prisma } from "../../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { parseCasStatement, classifyAsBuy } from "../imports/cas-cams-kfintech";

dotenv.config({ quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const UNIT_SCALE = 6;

// Known ahead of time from the CAS itself: every ISIN it lists against the
// symbol already held in this app. A real importer would resolve this from
// Instrument.isin/externalId once populated (this run is what populates
// isin for the first time); hardcoded here because there are exactly 7 and
// they're already confirmed against the live database.
const ISIN_TO_SYMBOL: Record<string, string> = {
  INF194KB1AL4: "BANDHAN_SMALL",
  INF179K01UT0: "HDFC_FLEXI",
  INF109KC1GH2: "ICICI_PHARMA",
  INF205K01MV6: "INVESCO_MID",
  INF22M001093: "JIOBR_FLEXI",
  INF247L01445: "MOTILAL_MID",
  INF204K01K15: "NIPPON_SMALL",
};

// The two funds where the CAS total is authoritative over the live Holding
// (see module comment). Corrected to exactly what the CAS folios sum to.
const RECONCILE_SYMBOLS = new Set(["BANDHAN_SMALL", "JIOBR_FLEXI"]);

function d(v: number | string): Prisma.Decimal {
  return new Prisma.Decimal(String(v));
}

async function main() {
  const email = process.env.OWNER_EMAIL;
  const user = email
    ? await prisma.user.findFirst({ where: { email } })
    : await prisma.user.findFirst();
  if (!user) {
    console.error("No user found (checked OWNER_EMAIL, then any user).");
    process.exit(1);
  }
  console.log(`Backfilling for user: ${user.email ?? user.id}`);

  const casPath = path.join("data", "cas-raw", "cas-2026-09-11.txt");
  const text = fs.readFileSync(casPath, "utf8");
  const { transactions, folios, unparsed } = parseCasStatement(text);
  if (unparsed.length) {
    console.error(`Refusing to proceed: ${unparsed.length} unparsed line(s):`);
    for (const line of unparsed) console.error("  " + line);
    process.exit(1);
  }
  console.log(`Parsed ${transactions.length} transactions across ${folios.length} folios.`);

  // --- Part 1: real Transaction rows from the CAS ---------------------------
  let inserted = 0;
  let skippedExisting = 0;
  const touchedSymbols = new Set<string>();

  for (const row of transactions) {
    if (!classifyAsBuy(row)) {
      console.warn(`Skipping non-BUY-looking row (needs review): ${row.description}`);
      continue;
    }
    const symbol = ISIN_TO_SYMBOL[row.isin];
    if (!symbol) {
      console.warn(`No known instrument for ISIN ${row.isin} (${row.fundName}) - skipped.`);
      continue;
    }
    const instrument = await prisma.instrument.findUnique({
      where: { type_symbol: { type: "MUTUAL_FUND", symbol } },
    });
    if (!instrument) {
      console.warn(`Instrument ${symbol} not found in DB - skipped.`);
      continue;
    }
    if (!instrument.isin) {
      await prisma.instrument.update({
        where: { id: instrument.id },
        data: { isin: row.isin },
      });
    }
    touchedSymbols.add(symbol);

    // Every fund backfilled here has exactly one Holding (GROWW) - confirmed
    // against the live database, not assumed - so this lookup is unambiguous.
    // A future CAS covering a fund held under more than one broker would need
    // the same source-mapping question TODO.md already flags for that case.
    const holding = await prisma.holding.findUnique({
      where: {
        userId_instrumentId_source: {
          userId: user.id,
          instrumentId: instrument.id,
          source: "GROWW",
        },
      },
    });

    const existing = await prisma.transaction.findFirst({
      where: {
        userId: user.id,
        instrumentId: instrument.id,
        source: "CAS_IMPORT",
        importRef: row.lineRef,
      },
    });
    if (existing) {
      skippedExisting++;
      continue;
    }

    await prisma.transaction.create({
      data: {
        userId: user.id,
        instrumentId: instrument.id,
        holdingId: holding?.id,
        type: "BUY",
        quantity: d(row.units),
        pricePerUnit: d(row.price),
        amount: d(row.amount),
        date: new Date(`${row.date}T00:00:00.000Z`),
        source: "CAS_IMPORT",
        folio: row.folio,
        importRef: row.lineRef,
        notes: row.description,
      },
    });
    inserted++;
  }
  console.log(`Transactions: ${inserted} inserted, ${skippedExisting} already present.`);

  // --- Part 2: reconcile the two drifted funds to CAS truth ------------------
  const totalsByIsin = new Map<string, { units: number; cost: number }>();
  for (const f of folios) {
    const e = totalsByIsin.get(f.isin) ?? { units: 0, cost: 0 };
    e.units += f.closingUnits;
    e.cost += f.totalCostValue;
    totalsByIsin.set(f.isin, e);
  }

  for (const [isin, symbol] of Object.entries(ISIN_TO_SYMBOL)) {
    if (!RECONCILE_SYMBOLS.has(symbol)) continue;
    const totals = totalsByIsin.get(isin);
    if (!totals) continue;

    const instrument = await prisma.instrument.findUnique({
      where: { type_symbol: { type: "MUTUAL_FUND", symbol } },
    });
    if (!instrument) continue;
    const holding = await prisma.holding.findUnique({
      where: {
        userId_instrumentId_source: {
          userId: user.id,
          instrumentId: instrument.id,
          source: "GROWW",
        },
      },
    });
    if (!holding) {
      console.warn(`No GROWW holding found for ${symbol} - skipped reconciliation.`);
      continue;
    }

    const newQuantity = d(totals.units).toDecimalPlaces(UNIT_SCALE);
    const newAvgBuyPrice = d(totals.cost).div(newQuantity).toDecimalPlaces(UNIT_SCALE);

    console.log(
      `Reconciling ${symbol}: quantity ${holding.quantity} -> ${newQuantity}, ` +
        `avgBuyPrice ${holding.avgBuyPrice} -> ${newAvgBuyPrice} (CAS is source of truth)`,
    );

    await prisma.holding.update({
      where: { id: holding.id },
      data: { quantity: newQuantity, avgBuyPrice: newAvgBuyPrice },
    });
  }

  // --- Part 3: opening-balance stubs for every non-mutual-fund holding -------
  const otherHoldings = await prisma.holding.findMany({
    where: { instrument: { type: { not: "MUTUAL_FUND" } } },
    include: { instrument: true },
  });
  let stubsInserted = 0;
  let stubsSkipped = 0;
  for (const h of otherHoldings) {
    const importRef = `OPENING:${h.id}`;
    const existing = await prisma.transaction.findFirst({
      where: {
        userId: h.userId,
        instrumentId: h.instrumentId,
        source: "OPENING_BALANCE",
        importRef,
      },
    });
    if (existing) {
      stubsSkipped++;
      continue;
    }
    await prisma.transaction.create({
      data: {
        userId: h.userId,
        instrumentId: h.instrumentId,
        holdingId: h.id,
        type: "BUY",
        quantity: h.quantity,
        pricePerUnit: h.avgBuyPrice,
        amount: h.quantity.times(h.avgBuyPrice).toDecimalPlaces(2),
        date: h.createdAt,
        source: "OPENING_BALANCE",
        importRef,
        notes: `No source document available; recorded at the holding's entry date (${h.instrument.symbol}).`,
      },
    });
    stubsInserted++;
  }
  console.log(`Opening-balance stubs: ${stubsInserted} inserted, ${stubsSkipped} already present.`);

  console.log("Touched mutual-fund symbols:", [...touchedSymbols].sort().join(", "));
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

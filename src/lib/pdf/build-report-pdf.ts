import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import type { InstrumentType } from "@/generated/prisma";
import { formatPct, formatQuantity } from "@/lib/money";
import type { ExportReportData } from "./report-data";

/**
 * Renders `ExportReportData` into a PDF and returns its bytes.
 *
 * Money is never formatted with `formatInr`/`formatSignedInr` here: those use
 * `Intl.NumberFormat`'s currency style, which prints the ₹ glyph, and jsPDF's
 * built-in fonts (Helvetica, Courier) only cover WinAnsi's Latin range: ₹ is
 * outside it and renders as a missing-glyph box. "Rs." keeps the report
 * readable without pulling in and embedding a custom Unicode font for one
 * symbol.
 *
 * The only account identifiers that appear anywhere below are the same
 * `last4` values already shown on screen: `ExportReportData` is built from
 * the same queries that mask the dashboard, so there is no full account
 * number or IFSC in memory to leak in the first place.
 */

// ---------- palette (print-safe approximation of the app's Brass and Ink theme) ----------

const INK: [number, number, number] = [28, 24, 19];
const INK_MUTED: [number, number, number] = [110, 101, 86];
const BRASS: [number, number, number] = [155, 116, 61];
const BRASS_TINT: [number, number, number] = [247, 241, 230];
const BORDER: [number, number, number] = [223, 214, 198];
const GAIN: [number, number, number] = [39, 128, 82];
const LOSS: [number, number, number] = [178, 64, 45];
const WHITE: [number, number, number] = [255, 255, 255];

const PAGE_MARGIN = 40;
const TABLE_TOP_MARGIN = 64; // room for the running header on pages 2+

// ---------- money / date formatting (ASCII-only, see file header) ----------

const inrNumberFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function pdfInr(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}Rs. ${inrNumberFmt.format(Math.abs(value))}`;
}

function pdfSignedInr(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}Rs. ${inrNumberFmt.format(Math.abs(value))}`;
}

function pdfNative(value: number, currency: string): string {
  const num = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  if (currency === "INR") return `Rs. ${num}`;
  if (currency === "USD") return `$${num}`;
  return `${num} ${currency}`;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const timestampFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const TYPE_LABEL: Record<InstrumentType, string> = {
  IN_STOCK: "IN Stock",
  MUTUAL_FUND: "Mutual Fund",
  US_STOCK: "US Stock",
};

function pnlColor(value: number): [number, number, number] {
  if (value > 0) return GAIN;
  if (value < 0) return LOSS;
  return INK_MUTED;
}

function maskedAccount(last4: string | null): string {
  return last4 ? `•• ${last4}` : "Not set";
}

// ---------- layout helpers ----------

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(title, PAGE_MARGIN, y);
  doc.setDrawColor(...BRASS);
  doc.setLineWidth(1);
  doc.line(PAGE_MARGIN, y + 4, PAGE_MARGIN + 28, y + 4);
  return y + 20;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 56) {
    doc.addPage();
    return TABLE_TOP_MARGIN;
  }
  return y;
}

type KeyValueRow = [string, string, [number, number, number]?];

function keyValueTable(doc: jsPDF, rows: KeyValueRow[], startY: number): number {
  autoTable(doc, {
    startY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TABLE_TOP_MARGIN },
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      textColor: INK,
      cellPadding: { top: 3.5, bottom: 3.5, left: 0, right: 0 },
    },
    columnStyles: {
      0: { cellWidth: 220 },
      1: { font: "courier", halign: "right" },
    },
    body: rows.map(([label, value, color]) => [
      { content: label, styles: { textColor: INK_MUTED } },
      { content: value, styles: { textColor: color ?? INK, fontStyle: "bold" } },
    ]),
    didDrawPage: (d) => runningChrome(doc, d.pageNumber),
  });
  // @ts-expect-error jsPDF-autotable attaches this at runtime
  return doc.lastAutoTable.finalY + 18;
}

function dataTable(
  doc: jsPDF,
  head: string[],
  body: RowInput[],
  startY: number,
  columnStyles: Record<number, Record<string, unknown>> = {},
  foot?: RowInput,
): number {
  autoTable(doc, {
    startY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TABLE_TOP_MARGIN },
    theme: "grid",
    head: [head],
    body,
    foot: foot ? [foot] : undefined,
    showFoot: foot ? "lastPage" : "never",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: INK,
      lineColor: BORDER,
      lineWidth: 0.5,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: INK,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 8.5,
    },
    footStyles: {
      fillColor: BRASS_TINT,
      textColor: INK,
      fontStyle: "bold",
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: BRASS_TINT },
    columnStyles,
    didDrawPage: (d) => runningChrome(doc, d.pageNumber),
  });
  // @ts-expect-error jsPDF-autotable attaches this at runtime
  return doc.lastAutoTable.finalY + 18;
}

/** Slim running letterhead on every page after the first (page 1 has the full masthead instead). */
function runningChrome(doc: jsPDF, pageNumber: number) {
  if (pageNumber === 1) return;
  const width = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRASS);
  doc.text("CORPUS", PAGE_MARGIN, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK_MUTED);
  doc.text("Personal financial report", width - PAGE_MARGIN, 32, { align: "right" });
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.75);
  doc.line(PAGE_MARGIN, 40, width - PAGE_MARGIN, 40);
}

function drawMasthead(doc: jsPDF, data: ExportReportData): number {
  const width = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...BRASS);
  doc.text("CORPUS", PAGE_MARGIN, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Personal financial report", PAGE_MARGIN, 68);

  doc.setFontSize(9);
  doc.setTextColor(...INK_MUTED);
  const who = data.user.name ?? data.user.email ?? "";
  const whoLine = data.user.email && data.user.name ? `${who} · ${data.user.email}` : who;
  if (whoLine) doc.text(whoLine, width - PAGE_MARGIN, 50, { align: "right" });
  doc.text(`Generated ${timestampFmt.format(data.generatedAt)}`, width - PAGE_MARGIN, 63, {
    align: "right",
  });

  doc.setDrawColor(...BRASS);
  doc.setLineWidth(1.5);
  doc.line(PAGE_MARGIN, 82, width - PAGE_MARGIN, 82);

  return 108;
}

function stampFootersAndPageNumbers(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.line(PAGE_MARGIN, height - 40, width - PAGE_MARGIN, height - 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK_MUTED);
    doc.text(
      "Account and card numbers are masked to the last 4 digits, matching the app. Personal reference only, not investment advice.",
      PAGE_MARGIN,
      height - 28,
    );
    doc.text(`Page ${i} of ${pages}`, width - PAGE_MARGIN, height - 28, { align: "right" });
  }
}

// ---------- report ----------

export function buildReportPdf(data: ExportReportData): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = drawMasthead(doc, data);

  // -- Net worth --
  y = sectionTitle(doc, "Net worth", y);
  const nw = data.netWorth;
  y = keyValueTable(
    doc,
    [
      ["Net worth", pdfInr(nw.netWorthInr), nw.netWorthInr < 0 ? LOSS : undefined],
      ["Total assets", pdfInr(nw.totalAssetsInr)],
      ["  Investments", pdfInr(nw.investmentsInr)],
      ["  Bank balances", pdfInr(nw.bankInr)],
      ["  Other assets", pdfInr(nw.otherAssetsInr)],
      ["Total liabilities", pdfInr(nw.totalLiabilitiesInr)],
      ["  Credit card outstanding", pdfInr(nw.cardOutstandingInr)],
    ],
    y,
  );

  // -- Portfolio summary --
  y = ensureSpace(doc, y, 140);
  y = sectionTitle(doc, "Investments summary", y);
  const p = data.portfolio.summary;
  const rows: KeyValueRow[] = [
    ["Invested", pdfInr(p.investedInr)],
    ["Current value", pdfInr(p.totalValueInr)],
    ["Profit / loss", pdfSignedInr(p.pnlInr), pnlColor(p.pnlInr)],
    ["Return", formatPct(p.pnlPct), pnlColor(p.pnlPct)],
    ["Holdings", String(p.holdingsCount)],
  ];
  if (!p.hasLivePrices) {
    rows.push(["Note", "No live prices yet: values use cost basis"]);
  } else if (!p.fxIsLive) {
    rows.push(["Note", "USD/INR rate is a fallback, not live"]);
  }
  y = keyValueTable(doc, rows, y);

  // -- Holdings --
  if (data.portfolio.holdings.length > 0) {
    y = ensureSpace(doc, y, 100);
    y = sectionTitle(doc, "Holdings", y);
    const sorted = [...data.portfolio.holdings].sort((a, b) => b.weightPct - a.weightPct);
    const body: RowInput[] = sorted.map((h) => [
      h.symbol,
      TYPE_LABEL[h.type],
      h.source,
      formatQuantity(h.quantity),
      pdfNative(h.avgBuyPrice, h.currency),
      pdfNative(h.currentPrice, h.currency),
      pdfInr(h.investedInr),
      pdfInr(h.currentValueInr),
      { content: pdfSignedInr(h.pnlInr), styles: { textColor: pnlColor(h.pnlInr) } },
      { content: formatPct(h.pnlPct), styles: { textColor: pnlColor(h.pnlPct) } },
      `${h.weightPct.toFixed(1)}%`,
    ]);
    const totalPnl = p.totalValueInr - p.investedInr;
    y = dataTable(
      doc,
      ["Symbol", "Type", "App", "Qty", "Avg price", "Price", "Invested", "Value", "P&L", "P&L %", "Wt"],
      body,
      y,
      {
        3: { font: "courier", halign: "right" },
        4: { font: "courier", halign: "right" },
        5: { font: "courier", halign: "right" },
        6: { font: "courier", halign: "right" },
        7: { font: "courier", halign: "right" },
        8: { font: "courier", halign: "right" },
        9: { font: "courier", halign: "right" },
        10: { font: "courier", halign: "right" },
      },
      [
        "Total",
        "",
        "",
        "",
        "",
        "",
        pdfInr(p.investedInr),
        pdfInr(p.totalValueInr),
        pdfSignedInr(totalPnl),
        formatPct(p.pnlPct),
        "100%",
      ],
    );
  }

  // -- Allocation --
  if (data.assetClassAllocation.length > 0) {
    y = ensureSpace(doc, y, 110);
    y = sectionTitle(doc, "Allocation by asset class", y);
    y = dataTable(
      doc,
      ["Asset class", "Value", "Weight"],
      data.assetClassAllocation.map((s) => [s.label, pdfInr(s.valueInr), `${s.pct.toFixed(1)}%`]),
      y,
      { 1: { font: "courier", halign: "right" }, 2: { font: "courier", halign: "right" } },
    );
  }
  if (data.countryAllocation.length > 0) {
    y = ensureSpace(doc, y, 110);
    y = sectionTitle(doc, "Allocation by country", y);
    y = dataTable(
      doc,
      ["Country", "Value", "Weight"],
      data.countryAllocation.map((s) => [s.label, pdfInr(s.valueInr), `${s.pct.toFixed(1)}%`]),
      y,
      { 1: { font: "courier", halign: "right" }, 2: { font: "courier", halign: "right" } },
    );
  }

  // -- Where it lives --
  if (data.appConsolidation.groups.length > 0) {
    y = ensureSpace(doc, y, 110);
    y = sectionTitle(doc, "Where it lives", y);
    y = dataTable(
      doc,
      ["App", "Holdings", "Invested", "Value", "P&L", "Weight"],
      data.appConsolidation.groups.map((g) => [
        g.label,
        String(g.count),
        pdfInr(g.investedInr),
        pdfInr(g.valueInr),
        { content: pdfSignedInr(g.pnlInr), styles: { textColor: pnlColor(g.pnlInr) } },
        `${g.weightPct.toFixed(1)}%`,
      ]),
      y,
      {
        1: { font: "courier", halign: "right" },
        2: { font: "courier", halign: "right" },
        3: { font: "courier", halign: "right" },
        4: { font: "courier", halign: "right" },
        5: { font: "courier", halign: "right" },
      },
    );
  }

  // -- Bank accounts (masked) --
  if (data.bankAccounts.length > 0) {
    y = ensureSpace(doc, y, 110);
    y = sectionTitle(doc, "Bank accounts", y);
    y = dataTable(
      doc,
      ["Bank", "Type", "Account", "Balance", "As of"],
      data.bankAccounts.map((b) => [
        b.bankName,
        b.typeLabel,
        maskedAccount(b.last4),
        pdfInr(b.balanceInr),
        dateFmt.format(b.asOf),
      ]),
      y,
      { 3: { font: "courier", halign: "right" } },
    );
  }

  // -- Other assets --
  if (data.manualAssets.length > 0) {
    y = ensureSpace(doc, y, 110);
    y = sectionTitle(doc, "Other assets", y);
    y = dataTable(
      doc,
      ["Name", "Category", "Value", "As of"],
      data.manualAssets.map((a) => [a.name, a.categoryLabel, pdfInr(a.valueInr), dateFmt.format(a.asOf)]),
      y,
      { 2: { font: "courier", halign: "right" } },
    );
  }

  // -- Credit cards (masked) --
  if (data.creditCards.length > 0) {
    y = ensureSpace(doc, y, 110);
    y = sectionTitle(doc, "Credit cards", y);
    dataTable(
      doc,
      ["Issuer", "Network", "Card", "Outstanding", "Limit", "Utilization"],
      data.creditCards.map((c) => [
        c.issuer,
        c.networkLabel,
        maskedAccount(c.last4),
        pdfInr(c.outstandingInr),
        pdfInr(c.limitInr),
        `${c.utilizationPct.toFixed(0)}%`,
      ]),
      y,
      {
        3: { font: "courier", halign: "right" },
        4: { font: "courier", halign: "right" },
        5: { font: "courier", halign: "right" },
      },
    );
  }

  stampFootersAndPageNumbers(doc);

  return new Uint8Array(doc.output("arraybuffer"));
}

// Formatting helpers. All portfolio totals are normalized to INR (the base
// currency); native-currency figures (e.g. a US stock's USD price) are formatted
// in their own currency for the holdings table.

// Aggregates are shown in whole rupees. Paise are noise on a net worth or a
// position value, and they make columns of figures harder to scan. Per-unit
// prices keep their decimals via formatNative().
const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrCompactFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 2,
});

export function formatInr(value: number): string {
  return inrFormatter.format(value);
}

// Compact form for hero numbers, e.g. "₹12.3L", "₹1.2Cr".
export function formatInrCompact(value: number): string {
  return inrCompactFormatter.format(value);
}

// Signed INR with an explicit + for gains (− is built into the number).
export function formatSignedInr(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${inrFormatter.format(value)}`;
}

export function formatNative(value: number, currency: string): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// Quantities can be fractional (mutual-fund units); trim noise but keep precision.
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 4,
  }).format(value);
}

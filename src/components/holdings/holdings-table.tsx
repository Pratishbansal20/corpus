"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { selectClass } from "@/components/forms/fields";
import {
  formatInr,
  formatNative,
  formatPct,
  formatQuantity,
  formatSignedInr,
} from "@/lib/money";
import type { HoldingView } from "@/lib/portfolio/valuation";
import type { InstrumentType } from "@/generated/prisma";
import { HoldingFormDialog } from "./holding-form-dialog";
import { TopUpDialog } from "./top-up-dialog";
import type { SipBankView } from "@/lib/sips/constants";
import { DeleteHoldingDialog } from "./delete-holding-dialog";
import { ArrowUpDown } from "lucide-react";

const TYPE_BADGE: Record<InstrumentType, string> = {
  IN_STOCK: "IN",
  MUTUAL_FUND: "MF",
  US_STOCK: "US",
};

function pnlClass(value: number): string {
  if (value > 0) return "text-gain";
  if (value < 0) return "text-loss";
  return "text-muted-foreground";
}

type SortField =
  | "name"
  | "source"
  | "quantity"
  | "value"
  | "pnl"
  | "weight"
  | "xirr";
type SortOrder = "asc" | "desc";

function SortHeader({
  field,
  activeField,
  onSort,
  children,
}: {
  field: SortField;
  activeField: SortField;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
}) {
  const isActive = activeField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="group inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
    >
      {children}
      <ArrowUpDown className={`size-3.5 opacity-60 group-hover:opacity-100 ${isActive ? "text-primary opacity-100" : ""}`} />
    </button>
  );
}

export function HoldingsTable({
  holdings: initialHoldings,
  banks = [],
  // "avgBuy" (default): the Investments-page column set, unchanged.
  // "xirr": the Funds-page variant - the Avg buy (LTP) column swaps out for
  // XIRR, positioned next to P/L (a return figure belongs beside the other
  // return figure, not where a cost-basis figure used to sit) rather than in
  // the same slot Avg buy occupied. Everything else - sorting, actions,
  // mobile card layout - is the exact same component, on purpose: a mutual
  // fund shown here is still a real Holding, editable and top-up-able the
  // same way.
  metric = "avgBuy",
  // Which key to read out of each row's xirrByWindow map. Owned by the
  // caller (lib/funds' FundXirrSection), not this component: a toggle here
  // and a separate one on a summary stat above it could drift apart, the
  // same reasoning PortfolioTrends already settled on for its own range
  // picker governing two charts at once. Ignored when metric is "avgBuy".
  xirrWindow,
}: {
  holdings: HoldingView[];
  banks?: SipBankView[];
  metric?: "avgBuy" | "xirr";
  xirrWindow?: string;
}) {
  const [sortField, setSortField] = React.useState<SortField>("weight");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");

  const xirrPct = React.useCallback(
    (h: HoldingView): number | null => {
      if (!xirrWindow || !h.xirrByWindow) return null;
      return h.xirrByWindow[xirrWindow] ?? null;
    },
    [xirrWindow],
  );

  const sortedHoldings = React.useMemo(() => {
    return [...initialHoldings].sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;

      switch (sortField) {
        case "name":
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case "source":
          valA = a.source.toLowerCase();
          valB = b.source.toLowerCase();
          break;
        case "quantity":
          valA = a.quantity;
          valB = b.quantity;
          break;
        case "value":
          valA = a.currentValueInr;
          valB = b.currentValueInr;
          break;
        case "pnl":
          valA = a.pnlInr;
          valB = b.pnlInr;
          break;
        case "weight":
          valA = a.weightPct;
          valB = b.weightPct;
          break;
        case "xirr":
          // Missing/unavailable sinks to the bottom rather than erroring or
          // sorting arbitrarily among nulls.
          valA = xirrPct(a) ?? -Infinity;
          valB = xirrPct(b) ?? -Infinity;
          break;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [initialHoldings, sortField, sortOrder, xirrPct]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc"); // Default to desc for numeric/value fields
    }
  };

  return (
    <>
      {/* Mobile: sort control + card list (columns don't fit at phone widths). */}
      <div className="flex flex-col gap-3 md:hidden">
        <select
          value={`${sortField}:${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split(":") as [
              SortField,
              SortOrder,
            ];
            setSortField(field);
            setSortOrder(order);
          }}
          className={selectClass}
          aria-label="Sort holdings by"
        >
          <option value="weight:desc">Sort: Weight (high to low)</option>
          <option value="value:desc">Sort: Value (high to low)</option>
          <option value="pnl:desc">Sort: P/L (best first)</option>
          <option value="pnl:asc">Sort: P/L (worst first)</option>
          {metric === "xirr" && (
            <>
              <option value="xirr:desc">Sort: XIRR (best first)</option>
              <option value="xirr:asc">Sort: XIRR (worst first)</option>
            </>
          )}
          <option value="name:asc">Sort: Name (A–Z)</option>
          <option value="source:asc">Sort: Source</option>
        </select>

        <div className="flex flex-col gap-2">
          {sortedHoldings.map((h) => (
            <div
              key={h.id}
              className="border-border rounded-xl border p-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <Badge
                    variant="secondary"
                    className="mt-0.5 font-mono text-[10px]"
                  >
                    {TYPE_BADGE[h.type]}
                  </Badge>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{h.name}</div>
                    <div className="text-muted-foreground font-mono text-xs">
                      {h.symbol} · {h.source.replace("_", " ")}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <HoldingFormDialog
                    mode="edit"
                    initial={h}
                    trigger="icon"
                    label="Edit holding"
                  />
                  <DeleteHoldingDialog id={h.id} name={h.name} />
                </div>
              </div>

              <div className="text-muted-foreground mt-3 flex justify-between text-xs">
                <span>
                  Qty {formatQuantity(h.quantity)}
                  {metric === "avgBuy" ? (
                    <>
                      {" "}
                      · Avg {formatNative(h.avgBuyPrice, h.currency)}
                      {h.hasLivePrice &&
                        ` (${formatNative(h.currentPrice, h.currency)})`}
                    </>
                  ) : (
                    <> · XIRR {xirrPct(h) === null ? "—" : formatPct(xirrPct(h)!)}</>
                  )}
                </span>
                <span>
                  {h.weightPct.toFixed(1)}%{" "}
                  {metric === "avgBuy" ? "of portfolio" : "of funds"}
                </span>
              </div>

              <div className="mt-2 flex items-end justify-between">
                <div>
                  <div className="font-semibold num">
                    {formatInr(h.currentValueInr)}
                  </div>
                  {h.hasLivePrice ? (
                    <div className="text-muted-foreground text-[10px] num">
                      ({formatInr(h.investedInr)})
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-[10px]">
                      cost basis
                    </div>
                  )}
                </div>
                <div
                  className={`text-right text-sm num ${pnlClass(h.pnlInr)}`}
                >
                  <div>{formatSignedInr(h.pnlInr)}</div>
                  <div className="text-xs">{formatPct(h.pnlPct)}</div>
                </div>
              </div>

              {/* Its own row rather than a fourth control in the header: at
                  phone widths a labelled button up there cut the instrument
                  name down to about 100px. */}
              <div className="mt-3 flex justify-end">
                <TopUpDialog
                  target={{
                    id: h.id,
                    name: h.name,
                    symbol: h.symbol,
                    isFund: h.type === "MUTUAL_FUND",
                    currency: h.currency,
                    quantity: h.quantity,
                    avgBuyPrice: h.avgBuyPrice,
                  }}
                  banks={banks}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: full sortable table. */}
      <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>
              <SortHeader field="name" activeField={sortField} onSort={handleSort}>Instrument</SortHeader>
            </TableHead>
            <TableHead>
              <SortHeader field="source" activeField={sortField} onSort={handleSort}>Source</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="quantity" activeField={sortField} onSort={handleSort}>Qty</SortHeader>
            </TableHead>
            {metric === "avgBuy" && (
              <TableHead className="text-right">Avg buy (LTP)</TableHead>
            )}
            <TableHead className="text-right">
              <SortHeader field="value" activeField={sortField} onSort={handleSort}>Value (Invested)</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="pnl" activeField={sortField} onSort={handleSort}>P/L</SortHeader>
            </TableHead>
            {metric === "xirr" && (
              <TableHead className="text-right">
                <SortHeader field="xirr" activeField={sortField} onSort={handleSort}>XIRR</SortHeader>
              </TableHead>
            )}
            <TableHead className="text-right">
              <SortHeader field="weight" activeField={sortField} onSort={handleSort}>Weight</SortHeader>
            </TableHead>
            <TableHead className="w-[1%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedHoldings.map((h) => (
            <TableRow key={h.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                     {TYPE_BADGE[h.type]}
                  </Badge>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{h.name}</div>
                    <div className="text-muted-foreground font-mono text-xs">
                      {h.symbol}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {h.source.replace("_", " ")}
              </TableCell>
              <TableCell className="text-right num">
                {formatQuantity(h.quantity)}
              </TableCell>
              {metric === "avgBuy" && (
                <TableCell className="text-right num">
                  <div>{formatNative(h.avgBuyPrice, h.currency)}</div>
                  {h.hasLivePrice && (
                    <div className="text-muted-foreground text-[10px]">
                      ({formatNative(h.currentPrice, h.currency)})
                    </div>
                  )}
                </TableCell>
              )}
              <TableCell className="text-right num">
                <div>{formatInr(h.currentValueInr)}</div>
                {h.hasLivePrice ? (
                  <div className="text-muted-foreground text-[10px]">
                    ({formatInr(h.investedInr)})
                  </div>
                ) : (
                  <div className="text-muted-foreground text-[10px]">cost basis</div>
                )}
              </TableCell>
              <TableCell
                className={`text-right num ${pnlClass(h.pnlInr)}`}
              >
                <div>{formatSignedInr(h.pnlInr)}</div>
                <div className="text-xs">{formatPct(h.pnlPct)}</div>
              </TableCell>
              {metric === "xirr" && (
                <TableCell
                  className={`text-right num ${xirrPct(h) === null ? "text-muted-foreground" : pnlClass(xirrPct(h)!)}`}
                >
                  {xirrPct(h) === null ? "—" : formatPct(xirrPct(h)!)}
                </TableCell>
              )}
              <TableCell className="text-muted-foreground text-right num">
                {h.weightPct.toFixed(1)}%
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <TopUpDialog
                    target={{
                      id: h.id,
                      name: h.name,
                      symbol: h.symbol,
                      isFund: h.type === "MUTUAL_FUND",
                      currency: h.currency,
                      quantity: h.quantity,
                      avgBuyPrice: h.avgBuyPrice,
                    }}
                    banks={banks}
                  />
                  <HoldingFormDialog
                    mode="edit"
                    initial={h}
                    trigger="icon"
                    label="Edit holding"
                  />
                  <DeleteHoldingDialog id={h.id} name={h.name} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </>
  );
}

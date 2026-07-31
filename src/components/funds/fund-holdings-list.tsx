"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type Constituent = { stock: string; sector: string; weightPct: number };

const DEFAULT_VISIBLE = 10;

export function FundHoldingsList({
  constituents,
}: {
  constituents: Constituent[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded
    ? constituents
    : constituents.slice(0, DEFAULT_VISIBLE);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {visible.map((c) => (
          <div
            key={c.stock}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{c.stock}</span>
              <span className="text-muted-foreground text-[10px]">
                {c.sector}
              </span>
            </span>
            <span className="num">{c.weightPct.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {constituents.length > DEFAULT_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-primary hover:text-primary/80 mt-1 flex items-center gap-1 self-start text-xs font-medium"
        >
          <ChevronDown
            className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {expanded
            ? "Show less"
            : `Show all ${constituents.length} holdings`}
        </button>
      )}
    </div>
  );
}

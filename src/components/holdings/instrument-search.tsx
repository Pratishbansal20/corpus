"use client";

import * as React from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchInstrumentsAction } from "@/lib/instruments/actions";
import type { InstrumentHit } from "@/lib/instruments/search";
import { INSTRUMENT_TYPE_LABELS } from "@/lib/holdings/schema";

/**
 * Find something by name instead of typing its ticker.
 *
 * Picking a result fills the type, the symbol, the name and, for a fund, the
 * AMFI scheme code that makes NAV pricing exact. Typing any of those by hand
 * used to be the only option, and a wrong character meant a position that
 * silently never priced.
 *
 * Typing by hand is still allowed, via "enter it manually": a brand new listing
 * or something neither source knows about must not be a dead end.
 */
export function InstrumentSearch({
  onPick,
  onManual,
  autoFocus,
}: {
  onPick: (hit: InstrumentHit) => void;
  onManual: () => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<InstrumentHit[]>([]);
  const [pending, setPending] = React.useState(false);
  const [searched, setSearched] = React.useState(false);

  // The latest keystroke wins: without this an earlier, slower response can
  // land after a later one and repopulate the list with stale results.
  const requestRef = React.useRef(0);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Only to stop a pending timer firing after unmount. The search itself runs
  // from the change handler rather than an effect: it is a reaction to typing,
  // not to rendering, and driving it from an effect means setting state during
  // one, which the React Compiler rightly rejects.
  React.useEffect(() => () => clearTimeout(timerRef.current), []);

  function onQueryChange(value: string) {
    setQuery(value);
    clearTimeout(timerRef.current);

    const q = value.trim();
    const id = ++requestRef.current;

    if (q.length < 2) {
      setHits([]);
      setSearched(false);
      setPending(false);
      return;
    }

    setPending(true);
    // Debounced so a search does not fire on every keystroke.
    timerRef.current = setTimeout(async () => {
      const results = await searchInstrumentsAction(q);
      if (id !== requestRef.current) return;
      setHits(results);
      setSearched(true);
      setPending(false);
    }, 300);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search: Infosys, Parag Parikh Flexi Cap, AAPL"
          className="pr-9 pl-9"
          autoComplete="off"
          aria-label="Search for a stock or fund"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {pending && (
        <p className="text-muted-foreground flex items-center gap-2 px-1 py-2 text-xs">
          <Loader2 className="size-3.5 animate-spin" />
          Searching
        </p>
      )}

      {!pending && hits.length > 0 && (
        <ul className="border-border max-h-64 overflow-y-auto rounded-lg border">
          {hits.map((hit) => (
            <li key={`${hit.type}|${hit.symbol}`}>
              <button
                type="button"
                onClick={() => onPick(hit)}
                className="hover:bg-accent flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition-colors"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{hit.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {INSTRUMENT_TYPE_LABELS[hit.type]}
                    {hit.hint && <> · {hit.hint}</>}
                    {hit.type !== "MUTUAL_FUND" && <> · {hit.symbol}</>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!pending && searched && hits.length === 0 && (
        <p className="text-muted-foreground px-1 py-2 text-xs">
          Nothing found for that name.
        </p>
      )}

      <button
        type="button"
        onClick={onManual}
        className={cn(
          "text-muted-foreground hover:text-foreground self-start text-xs underline underline-offset-4",
        )}
      >
        Can&apos;t find it? Enter it manually
      </button>
    </div>
  );
}

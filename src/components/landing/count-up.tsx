"use client";

import { useEffect, useRef, useState } from "react";
import { formatInr } from "@/lib/money";

/**
 * Counts a rupee figure up on first paint. Purely decorative, so it starts at
 * the final value for anyone who has asked for reduced motion: the number is
 * never withheld.
 */
export function CountUp({
  to,
  durationMs = 1400,
  delayMs = 0,
}: {
  to: number;
  durationMs?: number;
  delayMs?: number;
}) {
  const [value, setValue] = useState(to);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;

    setValue(0);
    let start: number | null = null;

    const timer = window.setTimeout(() => {
      const tick = (now: number) => {
        if (start === null) start = now;
        const t = Math.min((now - start) / durationMs, 1);
        // Ease-out cubic: fast settle, no bounce.
        setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1) frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [to, durationMs, delayMs]);

  return <span className="tabular-nums">{formatInr(value)}</span>;
}

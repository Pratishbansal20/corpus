/**
 * The Corpus mark: a flat-cut C with a trend line drawn through the gap,
 * ending on a dot — the number itself. Single source of the mark's
 * geometry: every place that draws it (the sidebar/topbar wordmark, the
 * loading spinner, the browser favicon, the iOS/PWA install icons, the
 * link-share image, the offline page) reads these same constants, so there
 * is exactly one place to change its shape, weight or color.
 *
 * Geometry lives in a 24x24 box, ring centered at (12,12) r=8. The gap is
 * flat-cut (butt caps, not round) and spans 64° centered on 0°, i.e. the C
 * opens due right — the plain, legible reading of the letter, not a rotated
 * one. The line is a real trend line, not a straight arrow: it rises, dips
 * slightly, then rises again — rescaled from the approved design mockup's
 * 240-unit canvas (ring r=50) down to this ring's r=8, factor 0.14.
 *
 * `CARD_CORNER_RADIUS` draws the rounded card background some contexts sit
 * the mark on (the favicon, the PWA "any"-purpose icons, the offline page)
 * — same 24x24 box as the mark itself, so nothing needs re-centering for a
 * bigger canvas.
 *
 * Two ways to consume this, because of one real constraint:
 * - Normal React rendering (browser DOM, or a server component like
 *   `offline/page.tsx`) can use the components below (`MarkRing`,
 *   `MarkLineAndDot`, `MarkGlyph`, `MarkCard`) directly.
 * - `next/og`'s `ImageResponse` (Satori) — `apple-icon.tsx`,
 *   `opengraph-image.tsx`, `icons/[size]/route.tsx` — does NOT render these
 *   components; Satori only understands real `<svg>`/`<path>`/`<circle>`/
 *   `<rect>` elements written directly in the JSX it's given, not custom
 *   components or fragments composing them (confirmed: swapping a fragment
 *   for a `<g>` here didn't help — the indirection itself is the problem).
 *   Those three files import the raw `MARK_*` constants instead and write
 *   the elements inline, still off this one set of numbers.
 *
 * `icon.svg` is the one place neither approach reaches: Next's favicon
 * convention needs a literal static SVG file, which can't import
 * TypeScript. Its path data is copied by hand from the constants below and
 * must be kept in sync manually if this file changes.
 */

export const MARK_BRASS = "#d1a95e";
export const MARK_INK = "#14120f";

export const CARD_CORNER_RADIUS = 5;

export const MARK_RING_D = "M18.784 16.239 A8 8 0 1 1 18.784 7.761";
export const MARK_RING_STROKE_WIDTH = 3.4;

export const MARK_LINE_D = "M8.36 16.48 L12.84 13.82 L16.2 14.94 L21.52 9.62";
export const MARK_LINE_STROKE_WIDTH = 1.5;
export const MARK_DOT = { cx: 21.52, cy: 9.62, r: 1 };

/** The C: a flat-cut ring, gap on the right. Spun on its own by `LoadingMark`. */
export function MarkRing({
  color,
  opacity,
}: {
  color: string;
  opacity?: number;
}) {
  return (
    <path
      d={MARK_RING_D}
      stroke={color}
      strokeWidth={MARK_RING_STROKE_WIDTH}
      strokeLinecap="butt"
      opacity={opacity}
    />
  );
}

/** The trend line and its terminal dot — the resolved number. */
export function MarkLineAndDot({
  color,
  opacity,
}: {
  color: string;
  opacity?: number;
}) {
  return (
    <g>
      <path
        d={MARK_LINE_D}
        stroke={color}
        strokeWidth={MARK_LINE_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
      <circle
        cx={MARK_DOT.cx}
        cy={MARK_DOT.cy}
        r={MARK_DOT.r}
        fill={color}
        opacity={opacity}
      />
    </g>
  );
}

/** The whole mark: ring plus line. */
export function MarkGlyph({ color }: { color: string }) {
  return (
    <g>
      <MarkRing color={color} />
      <MarkLineAndDot color={color} />
    </g>
  );
}

/** The mark on its rounded ink card — the favicon-shaped "any" icons. */
export function MarkCard({
  ink = MARK_INK,
  brass = MARK_BRASS,
}: {
  ink?: string;
  brass?: string;
}) {
  return (
    <g>
      <rect width="24" height="24" rx={CARD_CORNER_RADIUS} fill={ink} />
      <MarkGlyph color={brass} />
    </g>
  );
}

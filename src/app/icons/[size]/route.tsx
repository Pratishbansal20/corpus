import { ImageResponse } from "next/og";
import {
  CARD_CORNER_RADIUS,
  MARK_BRASS,
  MARK_INK,
  MARK_LINE_D,
  MARK_LINE_STROKE_WIDTH,
  MARK_DOT,
  MARK_RING_D,
  MARK_RING_STROKE_WIDTH,
} from "@/lib/mark";

// PWA manifest icons (see src/app/manifest.ts), rasterized at the pixel
// sizes Android's install prompt and app switcher actually ask for. Not a
// second design: both variants below draw off the exact same `@/lib/mark`
// constants as icon.svg and apple-icon.tsx, just rendered bigger, so there
// is no way for this mark to drift from those two over time.
//
// Elements are written inline rather than via `@/lib/mark`'s components:
// Satori (this route renders through `next/og`'s `ImageResponse`) doesn't
// render custom components or fragments, only real SVG elements — see the
// comment in `@/lib/mark` for how that was found.
export const dynamic = "force-static";

// "any"-purpose icons (192, 512): the mark on its rounded card, same as the
// browser-tab favicon — browsers apply their own rounding untouched.
function CardMark() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx={CARD_CORNER_RADIUS} fill={MARK_INK} />
      <path
        d={MARK_RING_D}
        stroke={MARK_BRASS}
        strokeWidth={MARK_RING_STROKE_WIDTH}
        strokeLinecap="butt"
      />
      <path
        d={MARK_LINE_D}
        stroke={MARK_BRASS}
        strokeWidth={MARK_LINE_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={MARK_DOT.cx} cy={MARK_DOT.cy} r={MARK_DOT.r} fill={MARK_BRASS} />
    </svg>
  );
}

// Maskable icon: ink fills the canvas edge to edge, no corner radius of our
// own, because a maskable icon's OS-applied shape (circle, squircle,
// whatever the launcher picks) does its own cropping — baking in a second
// rounded rect just insets the mark inside a visible frame, the same
// reasoning apple-icon.tsx documents. The mark is sized to well under the
// ~80% "safe zone" a maskable icon needs to survive a circular crop
// unclipped.
function EdgeToEdgeMark({ canvasSize }: { canvasSize: number }) {
  const markSize = Math.round(canvasSize * 0.62);
  return (
    <div
      style={{
        width: canvasSize,
        height: canvasSize,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: MARK_INK,
      }}
    >
      <svg width={markSize} height={markSize} viewBox="0 0 24 24" fill="none">
        <path
          d={MARK_RING_D}
          stroke={MARK_BRASS}
          strokeWidth={MARK_RING_STROKE_WIDTH}
          strokeLinecap="butt"
        />
        <path
          d={MARK_LINE_D}
          stroke={MARK_BRASS}
          strokeWidth={MARK_LINE_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={MARK_DOT.cx} cy={MARK_DOT.cy} r={MARK_DOT.r} fill={MARK_BRASS} />
      </svg>
    </div>
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size } = await params;

  if (size === "maskable-512") {
    return new ImageResponse(<EdgeToEdgeMark canvasSize={512} />, {
      width: 512,
      height: 512,
    });
  }

  const px = size === "512" ? 512 : 192;
  return new ImageResponse(
    (
      <div style={{ width: px, height: px, display: "flex" }}>
        <CardMark />
      </div>
    ),
    { width: px, height: px },
  );
}

import { ImageResponse } from "next/og";
import {
  MARK_BRASS,
  MARK_INK,
  MARK_LINE_D,
  MARK_LINE_STROKE_WIDTH,
  MARK_DOT,
  MARK_RING_D,
  MARK_RING_STROKE_WIDTH,
} from "@/lib/mark";

// iOS applies its own corner mask on the home screen, so this is drawn edge
// to edge with no rounded corners baked in: adding our own on top of iOS's
// would inset the mark inside a second, visible frame. `icon.svg`'s ring
// keeps its rounded card because that one is drawn inside a browser tab,
// which does no masking of its own.
//
// Elements are written inline rather than via `@/lib/mark`'s components:
// Satori (this file renders through `next/og`'s `ImageResponse`) doesn't
// render custom components or fragments, only real SVG elements — see the
// comment in `@/lib/mark` for how that was found. The numbers themselves
// still come from there, so there's one place to change them.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: MARK_INK,
        }}
      >
        <svg width="112" height="112" viewBox="0 0 24 24" fill="none">
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
    ),
    { ...size },
  );
}

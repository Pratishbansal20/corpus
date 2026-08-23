import { ImageResponse } from "next/og";
import {
  MARK_BRASS,
  MARK_LINE_D,
  MARK_LINE_STROKE_WIDTH,
  MARK_DOT,
  MARK_RING_D,
  MARK_RING_STROKE_WIDTH,
} from "@/lib/mark";

export const alt =
  "Corpus: every account, one number. A private finance hub for stocks, mutual funds, bank accounts, credit cards and net worth.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Deliberately no custom font here: the display face (Bricolage Grotesque)
// would need fetching from Google Fonts at generation time, and this image
// is static and cached at build, not worth a build-time network dependency
// for one card. The mark and the brand colors carry the identity; Satori's
// built-in sans is a perfectly good stand-in for one line of bold text.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "0 96px",
          background: "#100e0c",
        }}
      >
        {/* Same mark as the app icon and sidebar wordmark, numbers from
            @/lib/mark — written inline since Satori doesn't render that
            module's components (see the comment there). */}
        <svg width="88" height="88" viewBox="0 0 24 24" fill="none">
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

        <div
          style={{
            marginTop: 40,
            fontSize: 104,
            fontWeight: 700,
            letterSpacing: "-3px",
            color: "#eee8de",
            lineHeight: 1,
          }}
        >
          Corpus
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 34,
            color: "#a89f8f",
          }}
        >
          Every account, one number.
        </div>

        {/* A composition line, the app's own signature graphic: everything
            you own resolved onto one rule. Segment widths are illustrative,
            not real data. */}
        <div
          style={{
            display: "flex",
            marginTop: 56,
            width: 620,
            height: 10,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          {[
            { w: 38, c: MARK_BRASS },
            { w: 22, c: "#6fa3a3" },
            { w: 16, c: "#9dbb93" },
            { w: 14, c: "#a387b8" },
            { w: 10, c: "#c97b4a" },
          ].map((s, i) => (
            <div
              key={i}
              style={{ width: `${s.w}%`, height: "100%", background: s.c }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}

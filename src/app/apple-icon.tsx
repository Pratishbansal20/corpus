import { ImageResponse } from "next/og";

// iOS applies its own corner mask on the home screen, so this is drawn edge
// to edge with no rounded corners baked in: adding our own on top of iOS's
// would inset the mark inside a second, visible frame. `icon.svg`'s ring
// keeps its rounded card because that one is drawn inside a browser tab,
// which does no masking of its own.
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
          background: "#14120f",
        }}
      >
        {/* Same ring-of-arcs geometry as icon.svg, scaled up: one heavier
            brass arc closing an otherwise faint five-arc ring. */}
        <svg
          width="112"
          height="112"
          viewBox="0 0 32 32"
          fill="none"
        >
          <g transform="rotate(-90 16 16)">
            <circle
              cx="16"
              cy="16"
              r="9.5"
              stroke="#d1a95e"
              strokeOpacity="0.32"
              strokeWidth="2.6"
              strokeDasharray="7.13 4.81"
            />
            <circle
              cx="16"
              cy="16"
              r="9.5"
              stroke="#d1a95e"
              strokeWidth="4"
              strokeDasharray="7.13 52.57"
            />
          </g>
        </svg>
      </div>
    ),
    { ...size },
  );
}

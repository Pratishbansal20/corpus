import type { MetadataRoute } from "next";

// Auto-discovered by Next and linked into every page's <head>. `icons` here
// is a separate list from the favicon/apple-touch-icon Next already
// generates from icon.svg/apple-icon.tsx (those are for the browser tab and
// iOS home screen respectively); this is what Android's install prompt and
// app switcher read. Same source geometry either way, see
// src/app/icons/[size]/route.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Corpus",
    short_name: "Corpus",
    description: "Every account, one number.",
    // Skips the marketing landing page on every launch: an installed PWA is
    // opened by someone who already has an account. requireUnlocked() still
    // redirects to /login on its own if the session has expired.
    start_url: "/dashboard",
    display: "standalone",
    // Matches viewport.themeColor in layout.tsx (the site's actual --background
    // token), not icon.svg's own slightly darker card shade: this is the
    // color behind the app, not the icon.
    background_color: "#100e0c",
    theme_color: "#100e0c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/maskable-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

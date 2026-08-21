import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without this, Next infers the root
  // from the nearest lockfile and picks up an unrelated one in the home folder.
  turbopack: {
    root: __dirname,
  },
  images: {
    // Google account profile photos.
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  experimental: {
    // Every dashboard page is dynamic (reads cookies/DB per request), so
    // Next's client Router Cache defaults to 0s for all of them: revisiting
    // a page you looked at 5 seconds ago re-runs the full server render,
    // same as a first visit. 30s means a Link-based nav back to a recently
    // viewed page (e.g. alternating Investments <-> Funds) reuses that
    // render instantly with no server round trip at all, instead of paying
    // for it again. Safe here specifically because every mutation in this
    // app already calls revalidatePath() on the pages it affects (the
    // established pattern, see ARCHITECTURE.md), which busts this same
    // cache immediately — so a stale render is only ever shown when nothing
    // has actually changed. Kept short (not minutes) since this is a
    // finance app: a typed URL or hard reload always bypasses this cache
    // and hits the server fresh regardless.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;

// Deliberately minimal: "light service worker for the app shell" per
// TODO.md, not an offline-everything cache. Corpus is fully dynamic
// (every dashboard page is a live DB read per request, see
// ARCHITECTURE.md), so there is no meaningful "offline data" to serve, and
// this project has already been burned once by an over-aggressive cache
// (Turbopack silently serving a stale build, see ARCHITECTURE.md's Known
// gotchas). This service worker does exactly one thing: on a navigation
// that fails because there's no network, show a small branded "you're
// offline" page instead of the browser's own error screen. It never
// caches JS/CSS bundles, API responses, or any authenticated page, so a
// new deploy is visible on the very next request with no stale-cache class
// of bug to worry about.
const CACHE = "corpus-shell-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Only ever intercept page navigations. Everything else (assets, API
  // calls, data fetches) passes straight through to the network exactly as
  // if this service worker did not exist.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});

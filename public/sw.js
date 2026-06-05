// Service Worker for Training Tracker.
//
// Goal: instant cold-open on Android Chrome. Browser may evict the page from
// memory after a few minutes; without SW that means full network round-trip
// for index.html + JS bundle + assets every time the user taps the icon.
// With SW the app shell is served from local cache → first paint <100ms.
//
// Strategy:
//   • /assets/*  (hashed, immutable)        → cache-first, fill on miss.
//   • navigation / index.html               → network-first with 2s timeout,
//                                             fallback to cached "/" so a slow
//                                             or offline tap still opens the app.
//   • icons, manifest, favicons             → cache-first, refresh in background.
//   • cross-origin (Apps Script /exec API)  → bypass SW entirely. Live API only.
//
// Cache busting: bump CACHE_VERSION when sw.js itself changes. Hashed bundles
// invalidate themselves via filename so we don't need version bumps for code
// deploys — only when the SW logic here changes.

const CACHE_VERSION = "tt-v1";
const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/favicon-32.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request, timeoutMs = 2000) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      const cached = (await caches.match(request)) || (await caches.match("/"));
      if (cached) resolve(cached);
      else resolve(fetch(request)); // last resort: keep waiting on net
    }, timeoutMs);

    fetch(request)
      .then(async (resp) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put("/", clone)).catch(() => {});
        }
        resolve(resp);
      })
      .catch(async () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const cached = (await caches.match(request)) || (await caches.match("/"));
        resolve(cached || new Response("Offline", { status: 503 }));
      });
  });
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const resp = await fetch(request);
    if (resp && resp.ok) {
      const clone = resp.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(request, clone)).catch(() => {});
    }
    return resp;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Don't touch cross-origin requests — API calls to Apps Script /exec must hit
  // network live; queue draining handles offline at the app layer.
  if (url.origin !== self.location.origin) return;

  // Vite hashed assets are immutable → safe to cache-first forever.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Navigations (the HTML doc) — network-first with timeout + cache fallback.
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(networkFirst(req, 2000));
    return;
  }

  // Manifest, icons, favicons — cache-first.
  event.respondWith(cacheFirst(req));
});

const STATIC_CACHE = "ozy-static-v4";
const API_CACHE = "ozy-api-v4";
const OFFLINE_FALLBACK = "/index.html";
const STATIC_ASSETS = [
  OFFLINE_FALLBACK,
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

function offlineHtmlPage() {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Offline</title>
<style>body{font-family:system-ui,sans-serif;background:#0d1117;color:#c9d1d9;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:1rem;text-align:center;}
p{max-width:28rem;line-height:1.5}</style></head><body><p><strong>No connection.</strong><br/>Check your network and reload the page.</p></body></html>`,
    { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
const API_PREFIXES = ["/health", "/settings", "/audit", "/stats", "/claims", "/proposals", "/turns", "/voice", "/auth"];

function isApiRequest(url) {
  return API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll(STATIC_ASSETS).catch(() => cache.add(OFFLINE_FALLBACK)),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== STATIC_CACHE && key !== API_CACHE) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response.ok) {
            return response;
          }
          const copy1 = response.clone();
          const copy2 = response.clone();
          void caches.open(STATIC_CACHE).then((cache) => {
            void cache.put(event.request, copy1);
            void cache.put(OFFLINE_FALLBACK, copy2);
            void cache.put(new URL("/", self.location.origin).toString(), response.clone());
          });
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE);
          const fallback =
            (await cache.match(event.request)) ||
            (await cache.match(OFFLINE_FALLBACK)) ||
            (await cache.match(new URL("/", self.location.origin).toString()));
          if (fallback) {
            return fallback;
          }
          return offlineHtmlPage();
        }),
    );
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const contentType = response.headers.get("content-type") ?? "";
          if (response.ok && contentType.includes("application/json")) {
            const responseCopy = response.clone();
            void caches.open(API_CACHE).then((cache) => cache.put(event.request, responseCopy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) {
            return cached;
          }
          return new Response(JSON.stringify({ detail: "offline" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          const responseCopy = response.clone();
          void caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, responseCopy));
          return response;
        })
        .catch(() => new Response("", { status: 503 }));
    }),
  );
});

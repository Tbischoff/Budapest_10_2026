const CACHE_NAME = "travel-planner-v1.49.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/css/style.css?v=1.48.2",
  "./assets/js/app.js?v=1.48.2",
  "./data/places.js",
  "./assets/icons/favicon.svg",
  "./manifest.webmanifest?v=1.48.2"
];
const OPTIONAL_EXTERNAL = [
  "https://cdn.jsdelivr.net/npm/maplibre-gl@5.11.0/dist/maplibre-gl.css",
  "https://cdn.jsdelivr.net/npm/maplibre-gl@5.11.0/dist/maplibre-gl.js",
  "https://cdn.jsdelivr.net/npm/pmtiles@4.5.0/dist/pmtiles.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0",
  "https://cdn.jsdelivr.net/npm/@googlemaps/markerclusterer@2.6.2/dist/index.min.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Nur eigene, zwingend notwendige Dateien dürfen die Installation blockieren.
    await cache.addAll(APP_SHELL);
    // Externe Bibliotheken best effort cachen; ein CDN-Fehler darf Offline nicht zerstören.
    await Promise.allSettled(OPTIONAL_EXTERNAL.map(async url => {
      const response = await fetch(url, { mode: "cors" });
      if (response.ok) await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("./index.html", response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("./index.html")) ||
               (await cache.match("./")) ||
               Response.error();
      }
    })());
    return;
  }

  if (url.origin === self.location.origin || url.hostname === "cdn.jsdelivr.net") {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return Response.error();
      }
    })());
  }
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

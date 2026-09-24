const CACHE_NAME = "budapest-travel-v1.33.3";
const OFFLINE_MAP_CACHE = "budapest-offline-map-v1";
const APP_SHELL = ["./","./index.html","./assets/css/style.css?v=1.33.3","./assets/js/app.js?v=1.33.3","./data/places.js","./assets/icons/favicon.svg","./manifest.webmanifest?v=1.33.3",
  "https://cdn.jsdelivr.net/npm/maplibre-gl@5.11.0/dist/maplibre-gl.css",
  "https://cdn.jsdelivr.net/npm/maplibre-gl@5.11.0/dist/maplibre-gl.js",
  "https://cdn.jsdelivr.net/npm/pmtiles@4.3.0/dist/pmtiles.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0",
  "https://cdn.jsdelivr.net/npm/@googlemaps/markerclusterer@2.6.2/dist/index.min.js"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME && key !== OFFLINE_MAP_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.pathname.endsWith("/assets/maps/budapest.pmtiles") && request.headers.has("range")) {
    event.respondWith((async () => {
      const cache = await caches.open(OFFLINE_MAP_CACHE);
      const cached = await cache.match("./assets/maps/budapest.pmtiles");
      if (!cached) return fetch(request);
      const bytes = await cached.arrayBuffer();
      const match = /bytes=(\d+)-(\d*)/.exec(request.headers.get("range") || "");
      if (!match) return cached;
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : bytes.byteLength - 1;
      return new Response(bytes.slice(start, end + 1), {
        status: 206,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Range": "bytes " + start + "-" + end + "/" + bytes.byteLength,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1)
        }
      });
    })());
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => { const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put("./index.html",copy)); return response; }).catch(() => caches.match("./index.html").then(response => response || caches.match("./"))));
    return;
  }
  if (url.origin === self.location.origin || url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)); }
      return response;
    })));
  }
});
const CACHE_NAME = "budapest-travel-v1.19.1";
const APP_SHELL = ["./","./index.html","./assets/css/style.css?v=1.19.1","./assets/js/app.js?v=1.19.1","./data/places.js","./assets/icons/favicon.svg","./manifest.webmanifest?v=1.19.1"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => { const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put("./index.html",copy)); return response; }).catch(() => caches.match("./index.html").then(response => response || caches.match("./"))));
    return;
  }
  if (url.origin === self.location.origin) event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));} return response; })));
});
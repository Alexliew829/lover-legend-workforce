const CACHE_NAME = "ll-workforce-v177";
const ASSETS = [
  "./app/index.html",
  "./app/dashboard.html",
  "./css/style.css?v=1.81",
  "./js/dashboard.js?v=1.81",
  "./assets/icons/icon-192.png?v=1.81",
  "./assets/icons/icon-512.png?v=1.81"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

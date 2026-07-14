const CACHE_NAME = "ll-workforce-v175";
const ASSETS = [
  "./app/index.html", "./css/style.css", "./assets/icons/icon-192.png", "./assets/icons/icon-512.png"
];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))));
self.addEventListener("fetch", event => event.respondWith(fetch(event.request).catch(() => caches.match(event.request))));

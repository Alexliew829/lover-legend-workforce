const CACHE_NAME = "ll-workforce-v186";

const ASSETS = [
  "./app/index.html",
  "./app/dashboard.html",
  "./app/worker.html",
  "./app/advance.html",
  "./app/payroll.html",
  "./app/payslip.html",
  "./css/style.css?v=1.86",
  "./js/app.js?v=1.86",
  "./js/api.js?v=1.86",
  "./js/dashboard.js?v=1.86",
  "./js/worker.js?v=1.86",
  "./js/advance.js?v=1.86",
  "./js/payroll.js?v=1.86",
  "./js/payslip.js?v=1.86",
  "./assets/icons/icon-192.png?v=1.86",
  "./assets/icons/icon-512.png?v=1.86"
];

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        ASSETS.map(asset => cache.add(asset))
      )
    )
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  // Apps Script API uses POST. Do not intercept non-GET requests.
  // Returning without respondWith lets the browser handle the request normally.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Do not cache or intercept cross-origin requests.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === "navigate") {
          const home = await caches.match("./app/index.html");
          if (home) return home;
        }

        return new Response(
          "Offline / 暂时无法连接，请检查网络后重试。",
          {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          }
        );
      })
  );
});

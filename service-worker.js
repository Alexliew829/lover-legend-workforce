const CACHE_NAME = "ll-workforce-v188";

const APP_SHELL = [
  "./app/index.html",
  "./app/dashboard.html",
  "./app/worker.html",
  "./app/advance.html",
  "./app/payroll.html",
  "./app/payslip.html",
  "./app/settings.html",
  "./manifest.json",

  "./css/style.css?v=1.88",

  "./js/config.js?v=1.88",
  "./js/app.js?v=1.88",
  "./js/api.js?v=1.88",
  "./js/format.js?v=1.88",
  "./js/dashboard.js?v=1.88",
  "./js/worker.js?v=1.88",
  "./js/advance.js?v=1.88",
  "./js/payroll.js?v=1.88",
  "./js/payslip.js?v=1.88",

  "./assets/lover-legend-green.png",
  "./assets/lover-legend-red.jpg",
  "./assets/icons/apple-touch-icon.png?v=1.88",
  "./assets/icons/favicon.ico?v=1.88",
  "./assets/icons/icon-32.png?v=1.88",
  "./assets/icons/icon-180.png?v=1.88",
  "./assets/icons/icon-192.png?v=1.88",
  "./assets/icons/icon-256.png?v=1.88",
  "./assets/icons/icon-512.png?v=1.88",
  "./assets/icons/maskable-icon-512.png?v=1.88"
];

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        APP_SHELL.map(asset => cache.add(asset))
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

  // Apps Script API uses POST. Never intercept API writes or other non-GET requests.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept Apps Script or any other cross-origin request.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstWithBackgroundRefresh(request));
    return;
  }

  event.respondWith(networkFirstResource(request));
});

function isStaticAsset(url) {
  return (
    url.pathname.includes("/css/") ||
    url.pathname.includes("/js/") ||
    url.pathname.includes("/assets/") ||
    /\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|json)$/i.test(url.pathname)
  );
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const home =
      await caches.match("./app/index.html") ||
      await caches.match("./app/dashboard.html");

    if (home) return home;

    return offlineResponse();
  }
}

async function cacheFirstWithBackgroundRefresh(request) {
  const cached = await caches.match(request);

  const refreshPromise = fetch(request)
    .then(async response => {
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  if (cached) {
    // Refresh silently without delaying the page.
    refreshPromise.catch(() => {});
    return cached;
  }

  const networkResponse = await refreshPromise;
  return networkResponse || offlineResponse();
}

async function networkFirstResource(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (_) {
    const cached = await caches.match(request);
    return cached || offlineResponse();
  }
}

function offlineResponse() {
  return new Response(
    "Offline / 暂时无法连接，请检查网络后重试。",
    {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    }
  );
}

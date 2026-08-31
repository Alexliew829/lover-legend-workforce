document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }

  // V4.2: warm the current Dashboard summary in the background from Home.
  // This does not block Home rendering; Dashboard can show cached data immediately.
  if (typeof api === "function") {
    window.setTimeout(() => {
      const now = new Date();
      const monthKey = `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
      api("getDashboardSummary", { month: monthKey }).catch(() => {});
    }, 250);
  }
});

const API_READ_CACHE_MS = 10000;
const apiReadCache = new Map();
const apiPendingRequests = new Map();

const API_READ_ACTIONS = new Set([
  "getWorkers",
  "getAdvances",
  "getAdvanceBootstrap",
  "getDashboardSummary",
  "getAdvanceLedger",
  "getPayrolls",
  "getPayrollBootstrap",
  "getPayrollData",
  "createYearlyBackup",
  "translatePayrollRemarks"
]);

const API_WRITE_ACTIONS = new Set([
  "addWorker",
  "updateWorkerByNo",
  "resignWorker",
  "addAdvance",
  "updateAdvance",
  "savePayroll",
  "clearCache",
  "restoreYearlyBackup",
  "yearEndClose"
]);

function clearApiReadCache() {
  apiReadCache.clear();

  try {
    Object.keys(localStorage)
      .filter(key => key.startsWith("ll-api-cache-v186:"))
      .forEach(key => localStorage.removeItem(key));
  } catch (_) {}
}

function readPersistentApiCache(cacheKey) {
  try {
    const raw = localStorage.getItem("ll-api-cache-v186:" + cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - Number(parsed.time || 0) >= API_READ_CACHE_MS) {
      localStorage.removeItem("ll-api-cache-v186:" + cacheKey);
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

function writePersistentApiCache(cacheKey, data) {
  try {
    localStorage.setItem(
      "ll-api-cache-v186:" + cacheKey,
      JSON.stringify({ time: Date.now(), data })
    );
  } catch (_) {}
}

async function api(action, payload = {}) {
  const config = window.LL_CONFIG || {};
  const url = config.API_URL;

  if (!url || url.includes("PASTE_")) {
    throw new Error("API URL belum setup / 还没设置 API URL");
  }

  const isRead = API_READ_ACTIONS.has(action);
  const cacheKey = isRead ? `${action}:${JSON.stringify(payload)}` : "";

  if (isRead) {
    const cached = apiReadCache.get(cacheKey) || readPersistentApiCache(cacheKey);
    if (cached && Date.now() - cached.time < API_READ_CACHE_MS) {
      apiReadCache.set(cacheKey, cached);
      return cached.data;
    }

    if (apiPendingRequests.has(cacheKey)) {
      return apiPendingRequests.get(cacheKey);
    }
  }

  const request = (async () => {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        action,
        ...payload
      })
    });

    if (!response.ok) {
      throw new Error(`API HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "API Error");
    }

    const result = data.data || data;

    if (isRead) {
      const cachedValue = { time: Date.now(), data: result };
      apiReadCache.set(cacheKey, cachedValue);
      writePersistentApiCache(cacheKey, result);
    } else if (API_WRITE_ACTIONS.has(action)) {
      clearApiReadCache();
    }

    return result;
  })();

  if (isRead) apiPendingRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    if (isRead) apiPendingRequests.delete(cacheKey);
  }
}

function showStatus(id, message, ok = true) {
  const el = document.getElementById(id);
  if (!el) return;

  el.className = "status " + (ok ? "ok" : "err");
  el.textContent = message;
}

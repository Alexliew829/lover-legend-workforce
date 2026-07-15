const API_READ_CACHE_MS = 30000;
const API_STALE_CACHE_MS = 24 * 60 * 60 * 1000;
const API_CACHE_PREFIX = "ll-api-cache-v187:";

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

const API_INVALIDATION_MAP = {
  addWorker: [
    "getWorkers",
    "getAdvanceBootstrap",
    "getPayrollBootstrap",
    "getDashboardSummary"
  ],
  updateWorkerByNo: [
    "getWorkers",
    "getAdvanceBootstrap",
    "getPayrollBootstrap",
    "getDashboardSummary"
  ],
  resignWorker: [
    "getWorkers",
    "getAdvanceBootstrap",
    "getPayrollBootstrap",
    "getDashboardSummary"
  ],
  addAdvance: [
    "getAdvances",
    "getAdvanceBootstrap",
    "getAdvanceLedger",
    "getPayrollData",
    "getPayrollBootstrap",
    "getDashboardSummary"
  ],
  updateAdvance: [
    "getAdvances",
    "getAdvanceBootstrap",
    "getAdvanceLedger",
    "getPayrollData",
    "getPayrollBootstrap",
    "getDashboardSummary"
  ],
  savePayroll: [
    "getPayrolls",
    "getPayrollData",
    "getPayrollBootstrap",
    "getAdvanceLedger",
    "getDashboardSummary"
  ],
  restoreYearlyBackup: ["*"],
  yearEndClose: ["*"],
  clearCache: ["*"]
};

function makeApiCacheKey(action, payload = {}) {
  return `${action}:${JSON.stringify(payload || {})}`;
}

function getPersistentApiStorageKey(cacheKey) {
  return API_CACHE_PREFIX + cacheKey;
}

function clearApiReadCache(actions = ["*"]) {
  const actionList = Array.isArray(actions) ? actions : [actions];
  const clearAll = actionList.includes("*");

  for (const cacheKey of [...apiReadCache.keys()]) {
    const action = cacheKey.split(":", 1)[0];
    if (clearAll || actionList.includes(action)) {
      apiReadCache.delete(cacheKey);
    }
  }

  try {
    Object.keys(localStorage)
      .filter(key => key.startsWith(API_CACHE_PREFIX))
      .forEach(key => {
        const cacheKey = key.slice(API_CACHE_PREFIX.length);
        const action = cacheKey.split(":", 1)[0];

        if (clearAll || actionList.includes(action)) {
          localStorage.removeItem(key);
        }
      });
  } catch (_) {}
}

function readPersistentApiCache(cacheKey, maxAge = API_STALE_CACHE_MS) {
  try {
    const raw = localStorage.getItem(getPersistentApiStorageKey(cacheKey));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const age = Date.now() - Number(parsed?.time || 0);

    if (!parsed || !Object.prototype.hasOwnProperty.call(parsed, "data") || age >= maxAge) {
      localStorage.removeItem(getPersistentApiStorageKey(cacheKey));
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
      getPersistentApiStorageKey(cacheKey),
      JSON.stringify({ time: Date.now(), data })
    );
  } catch (_) {}
}

function getApiCachedData(action, payload = {}, maxAge = API_STALE_CACHE_MS) {
  const cacheKey = makeApiCacheKey(action, payload);
  const memory = apiReadCache.get(cacheKey);

  if (memory && Date.now() - Number(memory.time || 0) < maxAge) {
    return memory.data;
  }

  const persistent = readPersistentApiCache(cacheKey, maxAge);
  if (!persistent) return null;

  apiReadCache.set(cacheKey, persistent);
  return persistent.data;
}

function setApiCachedData(action, payload = {}, data) {
  const cacheKey = makeApiCacheKey(action, payload);
  const cachedValue = { time: Date.now(), data };

  apiReadCache.set(cacheKey, cachedValue);
  writePersistentApiCache(cacheKey, data);
}

function invalidateAfterWrite(action) {
  clearApiReadCache(API_INVALIDATION_MAP[action] || ["*"]);
}

async function api(action, payload = {}, options = {}) {
  const config = window.LL_CONFIG || {};
  const url = config.API_URL;

  if (!url || url.includes("PASTE_")) {
    throw new Error("API URL belum setup / 还没设置 API URL");
  }

  const isRead = API_READ_ACTIONS.has(action);
  const forceRefresh = Boolean(options.forceRefresh);
  const cacheKey = isRead ? makeApiCacheKey(action, payload) : "";

  if (isRead && !forceRefresh) {
    const cached =
      apiReadCache.get(cacheKey) ||
      readPersistentApiCache(cacheKey, API_READ_CACHE_MS);

    if (cached && Date.now() - Number(cached.time || 0) < API_READ_CACHE_MS) {
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
      setApiCachedData(action, payload, result);
    } else if (API_WRITE_ACTIONS.has(action)) {
      invalidateAfterWrite(action);
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

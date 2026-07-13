/*************************************************
 * Lover Legend Workforce ERP
 * Cache.gs — V1.7
 *************************************************/

const WORKFORCE_CACHE_SECONDS_ = 300;
const WORKFORCE_CACHE_KEYS_ = {
  WORKERS: "ll_workforce_workers_v17",
  ADVANCES: "ll_workforce_advances_v17",
  PAYROLLS: "ll_workforce_payrolls_v17"
};

function cacheRead_(key) {
  try {
    const text = CacheService.getScriptCache().get(key);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
}

function cacheWrite_(key, value) {
  try {
    const text = JSON.stringify(value);
    // Apps Script 单个缓存值有大小限制；过大时直接跳过，不影响系统运行。
    if (text.length < 95000) {
      CacheService.getScriptCache().put(key, text, WORKFORCE_CACHE_SECONDS_);
    }
  } catch (error) {
    // 缓存失败时继续使用 Google Sheet，不中断业务。
  }
  return value;
}

function cacheRemove_(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  try {
    CacheService.getScriptCache().removeAll(list.filter(Boolean));
  } catch (error) {}
}

function clearWorkforceCache_() {
  cacheRemove_(Object.keys(WORKFORCE_CACHE_KEYS_).map(key => WORKFORCE_CACHE_KEYS_[key]));
  return true;
}

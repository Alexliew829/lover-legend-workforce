async function api(action, payload = {}) {
  const config = window.LL_CONFIG || {};
  const url = config.API_URL;

  if (!url || url.includes("PASTE_")) {
    throw new Error("API URL belum setup / 还没设置 API URL");
  }

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({
      action,
      ...payload
    })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || "API Error");
  }

  return data.data || data;
}

function showStatus(id, message, ok = true) {
  const el = document.getElementById(id);
  if (!el) return;

  el.className = "status " + (ok ? "ok" : "err");
  el.textContent = message;
}

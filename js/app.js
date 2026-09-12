document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
});


const HOME_SYSTEM_STATUS_CACHE_KEY = "ll-workforce-system-status-v530";
let homeSystemStatusData = null;

function renderHomeSystemStatus(data) {
  const state = document.getElementById("homeSystemState");
  const text = document.getElementById("homeSystemText");
  const details = document.getElementById("homeSystemDetails");
  if (!state || !text || !details) return;
  homeSystemStatusData = data || {};
  const level = String(data?.level || "error");
  state.classList.remove("is-ok", "is-warning", "is-error", "is-checking");
  state.classList.add(level === "ok" ? "is-ok" : level === "warning" ? "is-warning" : "is-error");
  const issues = Array.isArray(data?.issues) ? data.issues : [];
  text.textContent = level === "ok" ? "系统正常" : level === "warning" ? `${issues.length} 项提醒` : `${issues.length || 1} 项异常`;
  details.innerHTML = issues.length ? `<div class="home-system-details-title">需要检查</div>${issues.map(x => `<div>• ${String(x).replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}</div>`).join("")}` : "";
  if (level === "ok") { details.hidden = true; state.setAttribute("aria-expanded", "false"); }
  try { localStorage.setItem(HOME_SYSTEM_STATUS_CACHE_KEY, JSON.stringify(data || {})); } catch (_) {}
}

async function checkHomeSystemStatus() {
  const btn = document.getElementById("homeSystemCheckBtn");
  const state = document.getElementById("homeSystemState");
  if (!btn || !state) return;
  btn.disabled = true; btn.textContent = "检查中…";
  state.classList.remove("is-ok","is-warning","is-error"); state.classList.add("is-checking");
  try {
    const data = await api("getSystemStatus", {}, { forceRefresh: true });
    renderHomeSystemStatus(data);
  } catch (error) {
    renderHomeSystemStatus({ level:"error", issues:["无法连接 Google Web App / Google Sheet"] });
  } finally { btn.disabled = false; btn.textContent = "重新检查"; }
}

document.addEventListener("DOMContentLoaded", () => {
  const state = document.getElementById("homeSystemState");
  const details = document.getElementById("homeSystemDetails");
  const btn = document.getElementById("homeSystemCheckBtn");
  if (!state || !details || !btn) return;
  try { const cached=JSON.parse(localStorage.getItem(HOME_SYSTEM_STATUS_CACHE_KEY)||"null"); if(cached) renderHomeSystemStatus(cached); } catch(_) {}
  state.addEventListener("click", () => {
    if (!homeSystemStatusData || homeSystemStatusData.level === "ok") return;
    details.hidden = !details.hidden; state.setAttribute("aria-expanded", String(!details.hidden));
  });
  btn.addEventListener("click", checkHomeSystemStatus);
  checkHomeSystemStatus();
});

let dashboardRequestToken = 0;

const DASHBOARD_COMPANIES = [
  "Lover Legend Adenium",
  "Lover Legend Gardening"
];

document.addEventListener("DOMContentLoaded", () => {
  setupDashboardPeriod();
  document.getElementById("dashboardMonth").addEventListener("change", loadDashboard);
  document.getElementById("dashboardYear").addEventListener("change", loadDashboard);
  loadDashboard();
});

function setupDashboardPeriod() {
  const now = new Date();
  const monthSelect = document.getElementById("dashboardMonth");
  const yearSelect = document.getElementById("dashboardYear");

  monthSelect.innerHTML = Array.from({ length: 12 }, (_, index) => {
    const value = String(index + 1).padStart(2, "0");
    return `<option value="${value}">${value}</option>`;
  }).join("");

  const startYear = 2025;
  const endYear = now.getFullYear() + 5;
  yearSelect.innerHTML = Array.from({ length: endYear - startYear + 1 }, (_, index) => {
    const year = startYear + index;
    return `<option value="${year}">${year}</option>`;
  }).join("");

  monthSelect.value = String(now.getMonth() + 1).padStart(2, "0");
  yearSelect.value = String(now.getFullYear());
}

async function loadDashboard() {
  const monthKey = getDashboardMonthKey();
  const token = ++dashboardRequestToken;
  const cached = readDashboardBrowserCache(monthKey);

  if (cached) {
    renderDashboard(cached);
    showStatus("status", "正在同步最新 Dashboard...", true);
  } else {
    document.getElementById("dashboard").innerHTML =
      '<div class="dashboard-loading">正在载入资料...</div>';
    showStatus("status", "正在读取 Dashboard...", true);
  }

  try {
    const summary = await api("getDashboardSummary", { month: monthKey });
    if (token !== dashboardRequestToken) return;
    writeDashboardBrowserCache(monthKey, summary);
    renderDashboard(summary);
    showStatus("status", "Dashboard 已更新", true);
  } catch (error) {
    if (token !== dashboardRequestToken) return;
    showStatus("status", error.message, false);
    if (!cached) {
      document.getElementById("dashboard").innerHTML =
        `<div class="dashboard-loading dashboard-error">${escapeDashboardHtml(error.message)}</div>`;
    }
  }
}

function renderDashboard(data) {
  const container = document.getElementById("dashboard");
  const companies = Array.isArray(data?.companies) ? data.companies : [];

  const companyCards = DASHBOARD_COMPANIES.map(company => {
    const item = companies.find(row => row.company === company) || {};
    return `
      <article class="dashboard-card dashboard-company-card">
        <div class="dashboard-card-label">${escapeDashboardHtml(company)}</div>
        <div class="dashboard-company-row"><span>工人数</span><strong>${Number(item.workerCount) || 0}</strong></div>
        <div class="dashboard-company-row"><span>本月实发</span><strong>${formatDashboardCurrency(item.netSalary)}</strong></div>
        <div class="dashboard-company-row dashboard-debt-row"><span>欠款余额</span><strong>${formatDashboardCurrency(item.debtBalance)}</strong></div>
      </article>
    `;
  }).join("");

  const payrollPercent = Math.max(0, Math.min(100, Number(data?.payrollPercent) || 0));

  container.innerHTML = `
    <article class="dashboard-card dashboard-highlight">
      <div class="dashboard-card-label">${escapeDashboardHtml(data?.month || getDashboardMonthKey())} · 本月实发工资</div>
      <div class="dashboard-big-money">${formatDashboardCurrency(data?.totalNet)}</div>
    </article>

    <div class="dashboard-stat-row">
      <article class="dashboard-card dashboard-mini-card"><div class="dashboard-card-label">总工人数</div><div class="dashboard-big-number">${Number(data?.workerCount) || 0}</div></article>
      <article class="dashboard-card dashboard-mini-card"><div class="dashboard-card-label">已出粮</div><div class="dashboard-big-number dashboard-paid">${Number(data?.paidCount) || 0}</div></article>
      <article class="dashboard-card dashboard-mini-card"><div class="dashboard-card-label">未出粮</div><div class="dashboard-big-number dashboard-unpaid">${Number(data?.unpaidCount) || 0}</div></article>
    </div>

    ${companyCards}

    <article class="dashboard-card dashboard-debt-card">
      <div class="dashboard-card-label">全部欠款余额</div>
      <div class="dashboard-big-money dashboard-debt-money">${formatDashboardCurrency(data?.totalDebt)}</div>
      <div class="dashboard-card-note">支粮 · 准证 · 其他</div>
    </article>

    <article class="dashboard-card">
      <div class="dashboard-card-label">本月 Payroll 进度</div>
      <div class="dashboard-progress-meta"><strong>${Number(data?.paidCount) || 0} / ${Number(data?.workerCount) || 0} 人</strong><strong>${payrollPercent}%</strong></div>
      <div class="dashboard-progress"><div class="dashboard-progress-bar" style="width:${payrollPercent}%"></div></div>
    </article>

    <article class="dashboard-card">
      <div class="dashboard-card-label">本月缺席</div>
      <div class="dashboard-big-number">${formatDashboardDay(data?.absenceDays)} 天</div>
      <div class="dashboard-absence-grid">
        <div><span>扣薪</span><strong>${formatDashboardDay(data?.absenceDeductDays)} 天</strong></div>
        <div><span>免扣</span><strong>${formatDashboardDay(data?.absenceWaivedDays)} 天</strong></div>
      </div>
    </article>
  `;
}

function getDashboardMonthKey() {
  return `${document.getElementById("dashboardMonth").value}-${document.getElementById("dashboardYear").value}`;
}

function readDashboardBrowserCache(monthKey) {
  try {
    const raw = sessionStorage.getItem(`ll-dashboard-v180-${monthKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed.data : null;
  } catch (error) {
    return null;
  }
}

function writeDashboardBrowserCache(monthKey, data) {
  try {
    sessionStorage.setItem(`ll-dashboard-v180-${monthKey}`, JSON.stringify({ data, time: Date.now() }));
  } catch (error) {}
}

function formatDashboardCurrency(value) {
  return "RM " + (Number(value) || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDashboardDay(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function escapeDashboardHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" }[char]));
}

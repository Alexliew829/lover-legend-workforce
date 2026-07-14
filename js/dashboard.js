let dashboardWorkers = [];
let dashboardAdvances = [];
let dashboardPayrolls = [];

const DASHBOARD_COMPANIES = [
  "Lover Legend Adenium",
  "Lover Legend Gardening"
];

document.addEventListener("DOMContentLoaded", () => {
  setupDashboardPeriod();
  document.getElementById("dashboardMonth").addEventListener("change", renderDashboard);
  document.getElementById("dashboardYear").addEventListener("change", renderDashboard);
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
  try {
    const data = await api("getPayrollBootstrap");
    dashboardWorkers = data?.workers || [];
    dashboardAdvances = data?.advances || [];
    dashboardPayrolls = data?.payrolls || [];

    renderDashboard();
    showStatus("status", "Dashboard 已更新", true);
  } catch (error) {
    showStatus("status", error.message, false);
    document.getElementById("dashboard").innerHTML =
      `<div class="dashboard-loading dashboard-error">${escapeDashboardHtml(error.message)}</div>`;
  }
}

function renderDashboard() {
  const container = document.getElementById("dashboard");
  const monthKey = getDashboardMonthKey();
  const activeWorkers = dashboardWorkers.filter(worker =>
    String(worker["状态"] || "在职") !== "离职"
  );
  const monthPayrolls = dashboardPayrolls.filter(item =>
    normalizeDashboardMonth(item["月份"]) === monthKey
  );

  const paidWorkerNos = new Set(
    monthPayrolls.map(item => String(item["工人编号"] || "")).filter(Boolean)
  );

  const workerCount = activeWorkers.length;
  const paidCount = activeWorkers.filter(worker =>
    paidWorkerNos.has(String(worker["工人编号"] || ""))
  ).length;
  const unpaidCount = Math.max(0, workerCount - paidCount);
  const totalNet = sumDashboardMoney(monthPayrolls, "实发薪水");
  const payrollPercent = workerCount > 0 ? Math.round((paidCount / workerCount) * 100) : 0;

  const absenceRecords = getDashboardAbsenceRecords(monthKey);
  const absenceDays = absenceRecords.length;
  let absenceDeductDays = 0;
  let absenceWaivedDays = 0;

  monthPayrolls.forEach(item => {
    const days = Number(item["缺席天数"]) || 0;
    if (String(item["缺席处理"] || "扣薪") === "免扣") absenceWaivedDays += days;
    else absenceDeductDays += days;
  });

  // If Payroll has not been prepared yet, count recorded absence as pending deduction.
  if (!monthPayrolls.length && absenceDays > 0) {
    absenceDeductDays = absenceDays;
  }

  const companyCards = DASHBOARD_COMPANIES.map(company => {
    const companyWorkers = activeWorkers.filter(worker => worker["公司"] === company);
    const companyPayrolls = monthPayrolls.filter(item => item["公司"] === company);
    const companyNet = sumDashboardMoney(companyPayrolls, "实发薪水");
    const companyDebt = companyWorkers.reduce(
      (sum, worker) => sum + getWorkerOutstandingBalance(worker["工人编号"], monthKey),
      0
    );

    return `
      <article class="dashboard-card dashboard-company-card">
        <div class="dashboard-card-label">${escapeDashboardHtml(company)}</div>
        <div class="dashboard-company-row"><span>工人数</span><strong>${companyWorkers.length}</strong></div>
        <div class="dashboard-company-row"><span>本月实发</span><strong>${formatDashboardCurrency(companyNet)}</strong></div>
        <div class="dashboard-company-row dashboard-debt-row"><span>欠款余额</span><strong>${formatDashboardCurrency(companyDebt)}</strong></div>
      </article>
    `;
  }).join("");

  const totalDebt = activeWorkers.reduce(
    (sum, worker) => sum + getWorkerOutstandingBalance(worker["工人编号"], monthKey),
    0
  );

  container.innerHTML = `
    <article class="dashboard-card dashboard-highlight">
      <div class="dashboard-card-label">${escapeDashboardHtml(monthKey)} · 本月实发工资</div>
      <div class="dashboard-big-money">${formatDashboardCurrency(totalNet)}</div>
    </article>

    <div class="dashboard-stat-row">
      <article class="dashboard-card dashboard-mini-card">
        <div class="dashboard-card-label">总工人数</div>
        <div class="dashboard-big-number">${workerCount}</div>
      </article>
      <article class="dashboard-card dashboard-mini-card">
        <div class="dashboard-card-label">已出粮</div>
        <div class="dashboard-big-number dashboard-paid">${paidCount}</div>
      </article>
      <article class="dashboard-card dashboard-mini-card">
        <div class="dashboard-card-label">未出粮</div>
        <div class="dashboard-big-number dashboard-unpaid">${unpaidCount}</div>
      </article>
    </div>

    ${companyCards}

    <article class="dashboard-card dashboard-debt-card">
      <div class="dashboard-card-label">全部欠款余额</div>
      <div class="dashboard-big-money dashboard-debt-money">${formatDashboardCurrency(totalDebt)}</div>
      <div class="dashboard-card-note">支粮 · 准证 · 其他</div>
    </article>

    <article class="dashboard-card">
      <div class="dashboard-card-label">本月 Payroll 进度</div>
      <div class="dashboard-progress-meta">
        <strong>${paidCount} / ${workerCount} 人</strong>
        <strong>${payrollPercent}%</strong>
      </div>
      <div class="dashboard-progress">
        <div class="dashboard-progress-bar" style="width:${payrollPercent}%"></div>
      </div>
    </article>

    <article class="dashboard-card">
      <div class="dashboard-card-label">本月缺席</div>
      <div class="dashboard-big-number">${formatDashboardDay(absenceDays)} 天</div>
      <div class="dashboard-absence-grid">
        <div><span>扣薪</span><strong>${formatDashboardDay(absenceDeductDays)} 天</strong></div>
        <div><span>免扣</span><strong>${formatDashboardDay(absenceWaivedDays)} 天</strong></div>
      </div>
    </article>
  `;
}

function getDashboardMonthKey() {
  const month = document.getElementById("dashboardMonth").value;
  const year = document.getElementById("dashboardYear").value;
  return `${month}-${year}`;
}

function getDashboardAbsenceRecords(monthKey) {
  return dashboardAdvances.filter(item => {
    if (String(item["项目"] || item["类型"] || "") !== "缺席") return false;
    const date = parseDashboardDate(item["日期时间"] || item["日期"] || item["扣款日期"]);
    if (!date) return false;
    const itemMonth = `${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
    return itemMonth === monthKey;
  });
}

function getWorkerOutstandingBalance(workerNo, selectedMonth) {
  const workerKey = String(workerNo || "");
  const debtTypes = ["支粮", "准证", "其他"];
  const totals = Object.fromEntries(debtTypes.map(type => [type, 0]));

  dashboardAdvances.forEach(item => {
    if (String(item["工人编号"] || "") !== workerKey) return;
    let type = String(item["项目"] || item["类型"] || "");
    if (type === "医疗") type = "其他";
    if (type in totals) totals[type] += parseDashboardMoney(item["金额"]);
  });

  dashboardPayrolls.forEach(item => {
    if (String(item["工人编号"] || "") !== workerKey) return;

    // Include all saved repayments up to the selected month.
    if (dashboardMonthNumber(item["月份"]) > dashboardMonthNumber(selectedMonth)) return;

    totals["支粮"] -= parseDashboardMoney(item["支粮扣款"]);
    totals["准证"] -= parseDashboardMoney(item["准证扣款"]);
    totals["其他"] -= parseDashboardMoney(item["欠款其他扣款"]);
    totals["其他"] -= parseDashboardMoney(item["医疗扣款"]);
  });

  return debtTypes.reduce((sum, type) => sum + Math.max(0, totals[type]), 0);
}

function dashboardMonthNumber(value) {
  const normalized = normalizeDashboardMonth(value);
  const match = normalized.match(/^(\d{2})-(\d{4})$/);
  return match ? Number(match[2]) * 100 + Number(match[1]) : 0;
}

function normalizeDashboardMonth(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return `${String(value.getMonth() + 1).padStart(2, "0")}-${value.getFullYear()}`;
  }

  const text = String(value).trim();
  let match = text.match(/^(\d{2})-(\d{4})$/);
  if (match) return `${match[1]}-${match[2]}`;

  match = text.match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[2]}-${match[1]}`;

  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? text
    : `${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function parseDashboardDate(value) {
  if (!value) return null;
  const text = String(value).trim();

  if (/^\d{2}-\d{2}-\d{4}/.test(text)) {
    const [day, month, year] = text.substring(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month, day] = text.substring(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return null;
}

function sumDashboardMoney(records, field) {
  return records.reduce((sum, item) => sum + parseDashboardMoney(item[field]), 0);
}

function parseDashboardMoney(value) {
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

function formatDashboardCurrency(value) {
  return "RM " + (Number(value) || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDashboardDay(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function escapeDashboardHtml(value) {
  return String(value || "").replace(/[&<>"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[char]));
}

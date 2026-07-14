let dashboardRequestToken = 0;

const DASHBOARD_COMPANIES = [
  "Lover Legend Adenium",
  "Lover Legend Gardening"
];

document.addEventListener("DOMContentLoaded", () => {
  setupDashboardPeriod();
  document.getElementById("dashboardMonth").addEventListener("change", loadDashboard);
  document.getElementById("dashboardYear").addEventListener("change", loadDashboard);

  document.getElementById("yearlyBackupBtn").addEventListener("click", handleYearlyBackup);
  document.getElementById("restoreBackupBtn").addEventListener("click", () => {
    document.getElementById("restoreBackupFile").click();
  });
  document.getElementById("restoreBackupFile").addEventListener("change", handleRestoreBackup);
  document.getElementById("yearEndCloseBtn").addEventListener("click", handleYearEndClose);

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
    const raw = sessionStorage.getItem(`ll-dashboard-v182-${monthKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed.data : null;
  } catch (error) {
    return null;
  }
}

function writeDashboardBrowserCache(monthKey, data) {
  try {
    sessionStorage.setItem(`ll-dashboard-v182-${monthKey}`, JSON.stringify({ data, time: Date.now() }));
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


async function handleYearlyBackup() {
  const year = Number(document.getElementById("dashboardYear").value);
  const button = document.getElementById("yearlyBackupBtn");

  try {
    button.disabled = true;
    button.textContent = "正在准备备份...";

    const backup = await api("createYearlyBackup", { year });
    downloadBackupJson(backup);

    showStatus(
      "maintenanceStatus",
      `${year} 年度备份已经下载。请妥善保存 JSON 文件。`,
      true
    );
  } catch (error) {
    showStatus("maintenanceStatus", error.message, false);
  } finally {
    button.disabled = false;
    button.textContent = "💾 年度备份 / Backup";
  }
}

async function handleRestoreBackup(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;

  const confirmed = confirm(
    "恢复会覆盖目前的系统资料。确定继续吗？\n\nRestore will overwrite current data."
  );
  if (!confirmed) return;

  const button = document.getElementById("restoreBackupBtn");

  try {
    button.disabled = true;
    button.textContent = "正在恢复...";

    const text = await file.text();
    const backup = JSON.parse(text);
    const result = await api("restoreYearlyBackup", { backup });

    sessionStorage.clear();
    showStatus(
      "maintenanceStatus",
      `恢复完成，共恢复 ${Number(result.restoredSheets) || 0} 个工作表。`,
      true
    );

    await loadDashboard();
  } catch (error) {
    showStatus("maintenanceStatus", "恢复失败：" + error.message, false);
  } finally {
    button.disabled = false;
    button.textContent = "♻ Restore / 恢复";
  }
}

async function handleYearEndClose() {
  const year = Number(document.getElementById("dashboardYear").value);
  const requiredText = `CLOSE ${year}`;

  const confirmation = prompt(
    `年底结转会清空 ${year} 年度的扣款、Payroll、Payslip、Dashboard 与 AuditLog。\\n` +
    `工人资料会保留，未还欠款会结转到 ${year + 1}。\\n\\n` +
    `请输入：${requiredText}`
  );

  if (confirmation === null) return;
  if (String(confirmation).trim().toUpperCase() !== requiredText) {
    showStatus("maintenanceStatus", "确认文字不正确，已经取消。", false);
    return;
  }

  const button = document.getElementById("yearEndCloseBtn");

  try {
    button.disabled = true;
    button.textContent = "正在执行年底结转...";

    const result = await api("yearEndClose", {
      year,
      confirmation: requiredText
    });

    if (result.backup) downloadBackupJson(result.backup);

    sessionStorage.clear();
    document.getElementById("dashboardYear").value = String(result.newYear || year + 1);
    document.getElementById("dashboardMonth").value = "01";

    showStatus(
      "maintenanceStatus",
      `${year} 年底结转完成。已自动下载备份，并结转 ${Number(result.carriedDebtRecords) || 0} 笔未还欠款。`,
      true
    );

    await loadDashboard();
  } catch (error) {
    showStatus("maintenanceStatus", error.message, false);
  } finally {
    button.disabled = false;
    button.textContent = "⚠ 年底结转 / Year-End Closing";
  }
}

function downloadBackupJson(backup) {
  const year = Number(backup && backup.backupYear) || new Date().getFullYear();
  const dateText = new Date().toISOString().slice(0, 10).split("-").reverse().join("-");
  const filename = `Lover Legend Workforce Backup ${year} ${dateText}.json`;

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

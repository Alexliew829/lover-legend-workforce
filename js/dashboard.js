let dashboardRequestToken = 0;

const DASHBOARD_COMPANIES = [
  "Lover Legend Adenium",
  "Lover Legend Gardening"
];

const MAINTENANCE_JOB_KEY = "ll-workforce-maintenance-job-v360";
const MAINTENANCE_JOB_NOTICE_PREFIX = "ll-workforce-maintenance-notice-v411:";

function maintenanceNoticeKey(jobId) {
  return MAINTENANCE_JOB_NOTICE_PREFIX + String(jobId || "");
}

function hasMaintenanceTerminalNoticeBeenShown(jobId) {
  if (!jobId) return false;
  try {
    return localStorage.getItem(maintenanceNoticeKey(jobId)) === "1";
  } catch (_) {
    return false;
  }
}

function markMaintenanceTerminalNoticeShown(jobId) {
  if (!jobId) return;
  try {
    localStorage.setItem(maintenanceNoticeKey(jobId), "1");
  } catch (_) {}
}

function clearMaintenanceTerminalNotice(jobId) {
  if (!jobId) return;
  try {
    localStorage.removeItem(maintenanceNoticeKey(jobId));
  } catch (_) {}
}

let maintenanceJobPollTimer = null;
let maintenanceOperationActive = false;

document.addEventListener("DOMContentLoaded", () => {
  setupDashboardPeriod();
  document.getElementById("dashboardMonth").addEventListener("change", loadDashboard);
  document.getElementById("dashboardYear").addEventListener("change", loadDashboard);

  document.getElementById("yearlyBackupBtn").addEventListener("click", handleYearlyBackup);
  document.getElementById("restoreBackupBtn").addEventListener("click", () => {
    document.getElementById("restoreBackupFile").click();
  });
  document.getElementById("restoreBackupFile").addEventListener("change", handleRestoreBackup);

  document.getElementById("restorePayrollPayslipBtn").addEventListener("click", () => {
    document.getElementById("restorePayrollPayslipFile").click();
  });
  document.getElementById("restorePayrollPayslipFile").addEventListener(
    "change",
    handleRestorePayrollPayslip
  );

  document.getElementById("yearEndCloseBtn").addEventListener("click", handleYearEndClose);

  resumeMaintenanceJob();
  window.addEventListener("beforeunload", event => {
    if (!maintenanceOperationActive) return;
    event.preventDefault();
    event.returnValue = "Backup / Restore 仍在进行中。";
  });
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

  const sessionCached = readDashboardBrowserCache(monthKey);
  const apiCached = typeof getApiCachedData === "function"
    ? getApiCachedData("getDashboardSummary", { month: monthKey })
    : null;
  const cached = sessionCached || apiCached;

  if (cached) {
    renderDashboard(cached);
    showStatus("status", "Dashboard 已显示，正在后台同步最新资料", true);
  } else {
    document.getElementById("dashboard").innerHTML =
      '<div class="dashboard-loading">正在载入资料...</div>';
    showStatus("status", "正在读取 Dashboard...", true);
  }

  try {
    const summary = await api(
      "getDashboardSummary",
      { month: monthKey },
      { forceRefresh: Boolean(cached) }
    );

    if (token !== dashboardRequestToken) return;

    writeDashboardBrowserCache(monthKey, summary);
    renderDashboard(summary);
    showStatus("status", "Dashboard 已更新", true);
  } catch (error) {
    if (token !== dashboardRequestToken) return;

    if (cached) {
      showStatus(
        "status",
        "暂时无法同步，正在使用上次成功载入的 Dashboard",
        false
      );
      return;
    }

    showStatus("status", error.message, false);
    document.getElementById("dashboard").innerHTML =
      `<div class="dashboard-loading dashboard-error">${escapeDashboardHtml(error.message)}</div>`;
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
    <article class="dashboard-card dashboard-highlight dashboard-payroll-summary-card">
      <div class="dashboard-card-label">${escapeDashboardHtml(data?.month || getDashboardMonthKey())} · 两间公司本月工资总数</div>
      <div class="dashboard-big-money">${formatDashboardCurrency(data?.totalGross)}</div>
      <div class="dashboard-payroll-summary-row dashboard-payroll-deduction-row">
        <span>总共扣款</span><strong>${formatDashboardCurrency(data?.totalDeduction)}</strong>
      </div>
      <div class="dashboard-payroll-summary-row dashboard-payroll-net-row">
        <span>实发工资总数</span><strong>${formatDashboardCurrency(data?.totalNet)}</strong>
      </div>
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
      <div class="dashboard-card-note">支粮 · 准证</div>
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
        <div><span>待处理</span><strong>${formatDashboardDay(data?.absencePendingDays)} 天</strong></div>
      </div>
    </article>
  `;
}

function getDashboardMonthKey() {
  return `${document.getElementById("dashboardMonth").value}-${document.getElementById("dashboardYear").value}`;
}

function readDashboardBrowserCache(monthKey) {
  try {
    const raw = sessionStorage.getItem(`ll-dashboard-v411-${monthKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed.data : null;
  } catch (error) {
    return null;
  }
}

function writeDashboardBrowserCache(monthKey, data) {
  try {
    sessionStorage.setItem(`ll-dashboard-v411-${monthKey}`, JSON.stringify({ data, time: Date.now() }));
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

    const jobId = beginMaintenanceJob("backup");
    showStatus("maintenanceStatus", "Backup 进行中 · 当前步骤：正在准备 Backup · 请勿关闭或 Refresh 页面", true);
    startMaintenanceJobPolling(jobId);
    const backup = await api("createYearlyBackup", { year, jobId });
    downloadBackupJson(backup);
    await finishMaintenanceJobFromServer(jobId);

    const verify = backup.verification || {};
    const months = Array.isArray(verify.payrollMonths)
      ? verify.payrollMonths.join(", ")
      : "-";

    showStatus(
      "maintenanceStatus",
      `✅ Backup 已完成 · Payroll ${Number(verify.payrollRows) || 0} 笔 · Payslip ${Number(verify.payslipRows) || 0} 笔 · ${backup.createdAt || ""}`,
      true
    );

    alert([
      "✅ Backup 已完成",
      `时间：${backup.createdAt || "-"}`,
      `Worker：${Number(verify.workerRows) || 0}`,
      `Advance：${Number(verify.advanceRows) || 0}`,
      `Payroll：${Number(verify.payrollRows) || 0}`,
      `Payslip：${Number(verify.payslipRows) || 0}`,
      `Payroll 月份：${months}`
    ].join("\n"));
  } catch (error) {
    await markCurrentMaintenanceFailure(error.message);
    showStatus("maintenanceStatus", "❌ Backup 失败：" + error.message, false);
    alert("❌ Backup 失败：" + error.message);
  } finally {
    button.disabled = false;
    button.textContent = "💾 手动备份 / Backup Now";
  }
}

async function handleRestoreBackup(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;

  const button = document.getElementById("restoreBackupBtn");

  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    const confirmed = confirm([
      "Restore 会覆盖目前的数据。",
      "",
      `Backup 时间：${backup.createdAt || "-"}`,
      "",
      "Restore 只恢复 Google Sheet 数据，不会改变网页程序、排版或计算公式。",
      "只有看到“✅ Restore 已完成并验证”才算真正成功。",
      "",
      "确定继续吗？"
    ].join("\n"));

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "正在恢复...";
    showStatus(
      "maintenanceStatus",
      "正在 Restore，请不要关闭页面……",
      true
    );

    const jobId = beginMaintenanceJob("restore");
    startMaintenanceJobPolling(jobId);
    const result = await api("restoreYearlyBackup", { backup, jobId });

    await finishMaintenanceJobFromServer(jobId);

    if (!result?.verified) {
      throw new Error("服务器没有返回 Restore 验证成功状态。");
    }

    if (typeof clearApiReadCache === "function") clearApiReadCache(["*"]);
    sessionStorage.clear();

    const verify = result.verification || {};
    const months = Array.isArray(verify.payrollMonths)
      ? verify.payrollMonths.join(", ")
      : "-";

    showStatus(
      "maintenanceStatus",
      `✅ Restore 已完成并验证 · Payroll ${Number(verify.payrollRows) || 0} 笔 · ${result.backupCreatedAt || ""}`,
      true
    );

    alert([
      "✅ Restore 已完成并验证",
      `恢复来源：${result.backupCreatedAt || "-"}`,
      `Worker：${Number(verify.workerRows) || 0}`,
      `Advance：${Number(verify.advanceRows) || 0}`,
      `Payroll：${Number(verify.payrollRows) || 0}`,
      `Payslip：${Number(verify.payslipRows) || 0}`,
      `Payroll 月份：${months}`
    ].join("\n"));

    await loadDashboard();
  } catch (error) {
    const message = "❌ Restore 失败：" + error.message;
    showStatus("maintenanceStatus", message, false);
    alert(message);
  } finally {
    button.disabled = false;
    button.textContent = "♻ Restore / 恢复";
  }
}

async function handleRestorePayrollPayslip(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;

  const button = document.getElementById("restorePayrollPayslipBtn");

  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    const confirmed = confirm([
      "这是紧急修复工具。",
      "只恢复 Backup 内的 Payroll / Payslip 数据。",
      "不会覆盖 Worker、Advance / 欠款及其他当前资料。",
      "",
      `Backup 时间：${backup.createdAt || "-"}`,
      "",
      "确定继续吗？"
    ].join("\n"));

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "正在恢复 Payroll...";
    showStatus(
      "maintenanceStatus",
      "正在紧急恢复 Payroll / Payslip，请不要关闭页面……",
      true
    );

    const jobId = beginMaintenanceJob("payrollRestore");
    startMaintenanceJobPolling(jobId);
    const result = await api("restorePayrollPayslipBackup", { backup, jobId });

    if (!result?.verified) {
      throw new Error("服务器没有返回 Payroll / Payslip 验证成功状态。");
    }

    if (typeof clearApiReadCache === "function") clearApiReadCache(["*"]);
    sessionStorage.clear();

    const verify = result.verification || {};
    const months = Array.isArray(verify.payrollMonths)
      ? verify.payrollMonths.join(", ")
      : "-";

    showStatus(
      "maintenanceStatus",
      `✅ Payroll / Payslip 恢复完成并验证 · Payroll ${Number(verify.payrollRows) || 0} 笔`,
      true
    );

    alert([
      "✅ Payroll / Payslip 恢复完成并验证",
      `恢复来源：${result.backupCreatedAt || "-"}`,
      `Payroll：${Number(verify.payrollRows) || 0}`,
      `Payslip：${Number(verify.payslipRows) || 0}`,
      `Payroll 月份：${months}`
    ].join("\n"));

    await loadDashboard();
  } catch (error) {
    const message = "❌ Payroll / Payslip 恢复失败：" + error.message;
    showStatus("maintenanceStatus", message, false);
    alert(message);
  } finally {
    button.disabled = false;
    button.textContent = "🧾 恢复 Payroll / Payslip（紧急修复）";
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
      `${year} 年底结转完成。完整资料已保存到历史归档并自动下载备份；已结转 ${Number(result.carriedDebtRecords) || 0} 笔未还欠款。`,
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
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-") + "_" + [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("-");

  const filename = `Lover Legend Workforce Backup_${stamp}.json`;

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


function createMaintenanceJobId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function beginMaintenanceJob(type) {
  const job = { jobId: createMaintenanceJobId(type), type, status: "running", step: "正在连接服务器", startedAt: new Date().toISOString() };
  clearMaintenanceTerminalNotice(job.jobId);
  localStorage.setItem(MAINTENANCE_JOB_KEY, JSON.stringify(job));
  maintenanceOperationActive = true;
  return job.jobId;
}

function readLocalMaintenanceJob() {
  try { return JSON.parse(localStorage.getItem(MAINTENANCE_JOB_KEY) || "null"); } catch (_) { return null; }
}

function writeLocalMaintenanceJob(job) {
  if (!job) return;
  localStorage.setItem(MAINTENANCE_JOB_KEY, JSON.stringify(job));
  maintenanceOperationActive = job.status === "running";
}

function maintenanceTypeLabel(type) {
  if (type === "backup") return "Backup";
  if (type === "payrollRestore") return "Payroll / Payslip Restore";
  return "Restore";
}

function renderMaintenanceJob(job, alertTerminal) {
  if (!job) return;

  writeLocalMaintenanceJob(job);
  const label = maintenanceTypeLabel(job.type);

  if (job.status === "running") {
    showStatus(
      "maintenanceStatus",
      `${label} 进行中 · 当前步骤：${job.step || "处理中"} · 请勿关闭或 Refresh 页面`,
      true
    );
    return;
  }

  stopMaintenanceJobPolling();

  const alreadyShown = hasMaintenanceTerminalNoticeBeenShown(job.jobId);

  if (job.status === "success") {
    const msg =
      `✅ ${label} 成功 · ${job.step || "已完成"}` +
      `${job.completedAt ? " · " + job.completedAt : ""}`;

    showStatus("maintenanceStatus", msg, true);

    // V3.8：成功/失败只弹一次。
    // Job 状态仍保留；重新进入 Dashboard 只显示状态条，不再重复 alert。
    if (alertTerminal && !alreadyShown) {
      alert(msg);
      markMaintenanceTerminalNoticeShown(job.jobId);
    }
  } else if (job.status === "failed") {
    const msg =
      `❌ ${label} 失败 · ${job.step || "处理失败"}` +
      `${job.error ? "\n原因：" + job.error : ""}`;

    showStatus("maintenanceStatus", msg.replace("\n", " · "), false);

    if (alertTerminal && !alreadyShown) {
      alert(msg);
      markMaintenanceTerminalNoticeShown(job.jobId);
    }
  }
}
async function fetchMaintenanceJob(jobId) {
  if (!jobId) return null;
  try { return await api("getMaintenanceJob", { jobId }, { forceRefresh: true }); } catch (_) { return null; }
}

function startMaintenanceJobPolling(jobId) {
  stopMaintenanceJobPolling();
  maintenanceOperationActive = true;
  maintenanceJobPollTimer = setInterval(async () => {
    const job = await fetchMaintenanceJob(jobId);
    if (job) renderMaintenanceJob(job, false);
  }, 2500);
}

function stopMaintenanceJobPolling() {
  if (maintenanceJobPollTimer) clearInterval(maintenanceJobPollTimer);
  maintenanceJobPollTimer = null;
  maintenanceOperationActive = false;
}

async function finishMaintenanceJobFromServer(jobId) {
  const job = await fetchMaintenanceJob(jobId);

  if (job) {
    renderMaintenanceJob(job, false);

    // The initiating Backup / Restore handler already shows its own final
    // success/failure message. Mark this terminal Job as acknowledged so
    // reopening Dashboard does not show the same alert again.
    if (job.status === "success" || job.status === "failed") {
      markMaintenanceTerminalNoticeShown(job.jobId);
    }
  } else {
    stopMaintenanceJobPolling();
  }
}

async function markCurrentMaintenanceFailure(message) {
  const local = readLocalMaintenanceJob();
  if (!local || local.status !== "running") return;
  const server = await fetchMaintenanceJob(local.jobId);
  if (server) renderMaintenanceJob(server, false);
  else renderMaintenanceJob(Object.assign({}, local, { status: "failed", step: "请求失败", error: message }), false);
}

async function resumeMaintenanceJob() {
  const local = readLocalMaintenanceJob();
  if (!local || !local.jobId) return;

  const server = await fetchMaintenanceJob(local.jobId);
  const job = server || local;

  const shouldAlertTerminal =
    job.status !== "running" &&
    !hasMaintenanceTerminalNoticeBeenShown(job.jobId);

  renderMaintenanceJob(job, shouldAlertTerminal);

  if (job.status === "running") {
    startMaintenanceJobPolling(job.jobId);
  }
}

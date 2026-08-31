let payrollWorkers = [];
let payrollAdvances = [];
let payrollRecords = [];
let selectedPayrollWorker = null;
let editingPayrollOriginalKey = null;

const PAYROLL_IS_MOBILE_ = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

function isPayrollMobileReadonly() {
  return PAYROLL_IS_MOBILE_;
}

function showPayrollDesktopOnlyMessage() {
  window.alert("手机可以查询及查看 Payroll 和工资单，但保存、修改、删除及打印请到电脑处理。");
}

function applyPayrollMobileReadonlyMode() {
  if (!isPayrollMobileReadonly()) return;

  const form = document.getElementById("payrollForm");
  const notice = document.getElementById("payrollMobileNotice");
  const mobileQueryFields = new Set(["payMonth", "payYear", "company", "workerNo"]);

  if (notice) notice.hidden = false;

  if (form) {
    form.classList.add("payroll-mobile-readonly");

    // 手机保留月份、年份、公司及工人查询；其他资料仅供完整查看。
    form.querySelectorAll("select").forEach(field => {
      const isQueryField = mobileQueryFields.has(field.name || field.id);
      field.disabled = !isQueryField;
      field.toggleAttribute("aria-disabled", !isQueryField);
      field.title = isQueryField
        ? "手机可用于查询 Payroll"
        : "手机只可查看，请到电脑处理";
    });

    form.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), textarea').forEach(field => {
      field.disabled = false;
      field.readOnly = true;
      field.setAttribute("aria-readonly", "true");
      field.title = "手机只可查看，请到电脑处理";
    });

    form.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(field => {
      field.disabled = true;
      field.setAttribute("aria-disabled", "true");
      field.title = "手机只可查看，请到电脑处理";
    });
  }

  document.querySelectorAll(".payroll-edit-btn, .payroll-delete-btn").forEach(button => {
    button.disabled = true;
    button.hidden = true;
    button.setAttribute("aria-disabled", "true");
    button.title = "手机可查询及查看 Payroll，修改及删除请到电脑处理";
  });

  const saveButton = document.getElementById("savePayrollBtn");
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.hidden = true;
    saveButton.setAttribute("aria-disabled", "true");
  }

  document.querySelectorAll(".payslip-link").forEach(link => {
    link.textContent = "查看工资单 / View Payslip";
    link.title = "手机可查看工资单，打印请到电脑处理";
  });
}
const payrollRemarkTranslationCache = new Map();
let payrollRemarkTranslationRun = 0;

const PAYROLL_DEFAULT_PERIOD_KEY = "ll-workforce-payroll-default-period-v330";

const DEBT_TYPES = ["支粮", "准证"];
const COMPANY_ORDER = {
  "Lover Legend Adenium": 1,
  "Lover Legend Gardening": 2
};

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("payrollForm");
  if (!form) return;

  setupPayrollMonthYear();

  form.company.addEventListener("change", handlePayrollCompanyChange);
  form.workerNo.addEventListener("change", handlePayrollWorkerChange);
  form.payMonth.addEventListener("change", handlePayrollPeriodChange);
  form.payYear.addEventListener("change", handlePayrollPeriodChange);
  form.querySelectorAll('input[name="absenceAction"]').forEach(input => {
    input.addEventListener("change", calculatePayroll);
  });

  if (form.workDays) {
    form.workDays.addEventListener("input", () => {
      renderSalaryAmountOnly();
      calculatePayroll();
    });
  }

  form.addEventListener("input", event => {
    if (event.target.classList.contains("debt-record-deduction-input")) {
      validateDebtRecordLimit(event.target, false);
      const type = event.target.dataset.type;
      const originalInput = getDebtNoteInput(type, "source");

      if (
        originalInput &&
        !String(originalInput.value || "").trim() &&
        parsePayrollMoney(event.target.value) > 0
      ) {
        originalInput.value = getDebtDeductionRemark(
          type,
          parsePayrollMoney(event.target.value)
        );
      }

      fillMissingMalayDebtNotes();
    }

    if (
      event.target.classList.contains("debt-record-deduction-input") ||
      event.target.name === "allowance" ||
      event.target.id === "allowance" ||
      event.target.name === "liveCommission" ||
      event.target.id === "liveCommission"
    ) {
      calculatePayroll();
    }
  });

  form.addEventListener("change", event => {
    if (
      event.target.classList.contains("debt-note-input") &&
      event.target.dataset.language === "source"
    ) {
      const type = event.target.dataset.type;
      const malayInput = getDebtNoteInput(type, "ms");

      if (malayInput) malayInput.value = "";
      fillMissingMalayDebtNotes();
    }
  });

  form.addEventListener("focusout", event => {
    if (event.target.classList.contains("debt-record-deduction-input")) {
      validateDebtRecordLimit(event.target, true);
      if (event.target.value.trim()) event.target.value = moneyInput(event.target.value);
      calculatePayroll();
    }

    if (
      event.target.name === "allowance" ||
      event.target.id === "allowance" ||
      event.target.name === "liveCommission" ||
      event.target.id === "liveCommission"
    ) {
      const value = parsePayrollMoney(event.target.value);

      event.target.value = value > 0
        ? moneyInput(value)
        : "";

      calculatePayroll();
    }
  });
form.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      (event.target.name === "allowance" || event.target.name === "liveCommission")
    ) {
        event.preventDefault();
        event.target.blur();
    }
});
  form.addEventListener("submit", handlePayrollSubmit);
  loadPayrollPage();
});

async function loadPayrollPage() {
  const cached = typeof getApiCachedData === "function"
    ? getApiCachedData("getPayrollBootstrap", {})
    : null;

  if (cached) {
    applyPayrollBootstrapData(cached);
    showStatus("status", "系统已就绪，正在后台同步最新资料", true);
    applyPayrollMobileReadonlyMode();
  }

  try {
    const data = await loadPayrollBootstrapWithRetry(Boolean(cached));

    applyPayrollBootstrapData(data);
    showStatus("status", "系统已就绪，可以计算 Payroll", true);
    await restorePayrollSelection();
    applyPayrollMobileReadonlyMode();
  } catch (error) {
    if (cached) {
      showStatus(
        "status",
        "暂时无法同步，正在使用上次成功载入的资料",
        false
      );
      return;
    }

    showStatus("status", error.message, false);
  }
}


async function loadPayrollBootstrapWithRetry(forceRefresh) {
  try {
    return await api("getPayrollBootstrap", {}, { forceRefresh });
  } catch (firstError) {
    // Apps Script偶尔冷启动失败，短暂等待后自动重试一次，避免用户看到一闪而过的红色错误。
    await new Promise(resolve => setTimeout(resolve, 700));
    try {
      return await api("getPayrollBootstrap", {}, { forceRefresh: true });
    } catch (_) {
      throw firstError;
    }
  }
}

function applyPayrollBootstrapData(data) {
  payrollWorkers = Array.isArray(data?.workers) ? data.workers : [];
  payrollAdvances = Array.isArray(data?.advances) ? data.advances : [];
  payrollRecords = Array.isArray(data?.payrolls) ? data.payrolls : [];

  renderPayrollWorkers();
  renderPayrollHistory();
}

function setupPayrollMonthYear() {
  const form = document.getElementById("payrollForm");
  const now = new Date();

  fillPayrollSelect(form.payMonth, 1, 12, "月");
  fillPayrollSelect(form.payYear, 2025, now.getFullYear() + 5, "年");

  const savedPeriod = getSavedPayrollDefaultPeriod();
  form.payMonth.value = savedPeriod.month;
  form.payYear.value = savedPeriod.year;
}

function getSavedPayrollDefaultPeriod() {
  const now = new Date();

  // V3.8：Payroll 默认月份以每月 8 日为切换点。
  // 例如 08-08 至 07-09 默认 08-2026；08-09 至 07-10 默认 09-2026。
  // 这里只决定进入页面时的默认月份，历史月份仍可手动选择。
  const payrollPeriodDate = now.getDate() <= 7
    ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
    : now;

  return {
    month: String(payrollPeriodDate.getMonth() + 1).padStart(2, "0"),
    year: String(payrollPeriodDate.getFullYear())
  };
}

function savePayrollDefaultPeriod(month, year) {
  const normalizedMonth = String(month || "").padStart(2, "0");
  const normalizedYear = String(year || "");
  if (!/^\d{2}$/.test(normalizedMonth) || !/^\d{4}$/.test(normalizedYear)) return;

  try {
    localStorage.setItem(PAYROLL_DEFAULT_PERIOD_KEY, JSON.stringify({
      month: normalizedMonth,
      year: normalizedYear
    }));
  } catch (_) {}
}

function fillPayrollSelect(select, start, end, label) {
  select.innerHTML = `<option value="">${label}</option>`;
  for (let i = start; i <= end; i++) {
    const value = label === "年" ? String(i) : String(i).padStart(2, "0");
    select.innerHTML += `<option value="${value}">${value}</option>`;
  }
}


function handlePayrollCompanyChange() {
  editingPayrollOriginalKey = null;
  resetPayrollEntryFields();
  renderPayrollWorkers();
}

function renderPayrollWorkers() {
  const form = document.getElementById("payrollForm");
  const workers = payrollWorkers
    .filter(worker => worker["公司"] === form.company.value)
    .sort((a, b) => String(a["工人编号"] || "").localeCompare(
      String(b["工人编号"] || ""), undefined, { numeric: true }
    ));

  form.workerNo.innerHTML = '<option value="">选择工人</option>' + workers.map(worker => `
    <option value="${escapePayrollHtml(worker["工人编号"])}">
      ${escapePayrollHtml(worker["工人编号"])} · ${escapePayrollHtml(worker["工人名字"])}
    </option>
  `).join("");

  clearPayrollWorkerDetails();
}

async function handlePayrollWorkerChange() {
  const form = document.getElementById("payrollForm");
  const selectedNo = form.workerNo.value;
  resetPayrollEntryFields({ keepWorkerSelection: true });
  form.workerNo.value = selectedNo;
  selectedPayrollWorker = payrollWorkers.find(worker =>
    String(worker["工人编号"]) === String(selectedNo)
  ) || null;

  if (!selectedPayrollWorker) {
    clearPayrollWorkerDetails();
    return;
  }

  // 先使用已载入的工人资料立即显示薪水，不再等待 API。
  form.salaryType.value = String(selectedPayrollWorker["薪水类型"] || "");
  renderSalarySection();
  renderAbsenceSection();
  renderDebtList();
  calculatePayroll();
  showSavedPayrollState();

}

async function handlePayrollPeriodChange() {
  const form = document.getElementById("payrollForm");
  savePayrollDefaultPeriod(form?.payMonth?.value, form?.payYear?.value);

  // 无论有没有选工人，月份切换后都立即刷新 Payroll 列表。
  renderPayrollHistory();

  if (!selectedPayrollWorker) return;

  renderSalarySection();
  renderAbsenceSection();
  renderDebtList();
  calculatePayroll();
  showSavedPayrollState();

}

function showSavedPayrollState() {
  const current = getCurrentMonthPayrollRecord();
  if (current) {
    showStatus("status", "已载入已保存的 Payroll，可直接修改", true);
  }
}

async function restorePayrollSelection() {

  const company = sessionStorage.getItem("payrollCompany");
  const worker = sessionStorage.getItem("payrollWorker");
  const month = sessionStorage.getItem("payrollMonth");
  const year = sessionStorage.getItem("payrollYear");

  if (!company || !worker) return;

  const form = document.getElementById("payrollForm");

  if (month) form.payMonth.value = month;
  if (year) form.payYear.value = year;

  form.company.value = company;

  renderPayrollWorkers();

  form.workerNo.value = worker;

  if (form.workerNo.value === worker) {
    await handlePayrollWorkerChange();
  } else {
    clearPayrollWorkerDetails();
  }

  sessionStorage.removeItem("payrollCompany");
  sessionStorage.removeItem("payrollWorker");
  sessionStorage.removeItem("payrollMonth");
  sessionStorage.removeItem("payrollYear");
}
async function refreshPayrollSourceData() {
  const data = await api("getPayrollData");
  payrollAdvances = data?.advances || [];
  payrollRecords = data?.payrolls || [];
}

function resetPayrollEntryFields({ keepWorkerSelection = false } = {}) {
  const form = document.getElementById("payrollForm");
  if (!form) return;

  if (!keepWorkerSelection) form.workerNo.value = "";
  form.salaryType.value = "";
  form.salaryRateDisplay.value = "";
  form.grossSalary.value = "";
  form.monthlyGrossSalary.value = "";
  if (form.workDays) form.workDays.value = "";
  const allowanceInput = getAllowanceInput(form);
  if (allowanceInput) allowanceInput.value = "";

  const liveCommissionInput = getLiveCommissionInput(form);
  if (liveCommissionInput) liveCommissionInput.value = "";

  form.remark.value = "";

  document.getElementById("dailySalaryRow").style.display = "none";
  document.getElementById("monthlySalaryRow").style.display = "none";
  document.getElementById("absenceDaysText").textContent = "本月 0 天";
  document.getElementById("absenceAmountText").textContent = "RM 0.00";
  document.getElementById("absenceNote").textContent = "没有缺席记录。";
  document.getElementById("debtList").innerHTML = '<p class="muted">选择工人后自动显示欠款。</p>';
  form.querySelector('input[name="absenceAction"][value="扣薪"]').checked = true;
  document.getElementById("totalDeductionText").textContent = "RM 0.00";
  document.getElementById("netSalaryText").textContent = "RM 0.00";
  document.getElementById("remainingDebtText").textContent = "RM 0.00";
  selectedPayrollWorker = null;
}

function clearPayrollWorkerDetails() {
  resetPayrollEntryFields({ keepWorkerSelection: true });
  calculatePayroll();
}

function renderSalarySection() {
  const form = document.getElementById("payrollForm");
  const dailyRow = document.getElementById("dailySalaryRow");
  const monthlyRow = document.getElementById("monthlySalaryRow");
  if (!selectedPayrollWorker) return;

  const salaryType = String(selectedPayrollWorker["薪水类型"] || "");

  if (salaryType === "日薪") {
    const current = getCurrentMonthPayrollRecord();
    const savedWorkDays = parsePayrollMoney(current && current["工作天数"]);

    dailyRow.style.display = "grid";
    monthlyRow.style.display = "none";
    form.salaryRateDisplay.value = moneyInput(selectedPayrollWorker["日薪"]);
    form.workDays.value = savedWorkDays > 0 ? formatDayCount(savedWorkDays) : String(getSelectedMonthDays());
    form.monthlyGrossSalary.value = "";
    renderSalaryAmountOnly();
  } else {
    dailyRow.style.display = "none";
    monthlyRow.style.display = "block";
    form.salaryRateDisplay.value = "";
    form.grossSalary.value = "";
    if (form.workDays) form.workDays.value = "";
    form.monthlyGrossSalary.value = moneyInput(getGrossSalary());
  }
}

function renderSalaryAmountOnly() {
  const form = document.getElementById("payrollForm");
  if (!selectedPayrollWorker) return;

  if (String(selectedPayrollWorker["薪水类型"] || "") === "日薪") {
    form.grossSalary.value = moneyInput(getGrossSalary());
  }
}

function getWorkDays() {
  const form = document.getElementById("payrollForm");
  if (!selectedPayrollWorker || String(selectedPayrollWorker["薪水类型"] || "") !== "日薪") return 0;
  return parsePayrollMoney(form.workDays?.value);
}

function getGrossSalary() {
  if (!selectedPayrollWorker) return 0;
  const salaryType = String(selectedPayrollWorker["薪水类型"] || "");
  if (salaryType === "日薪") {
    return parsePayrollMoney(selectedPayrollWorker["日薪"]) * getWorkDays();
  }
  return parsePayrollMoney(selectedPayrollWorker["月薪"]);
}

function getSelectedMonthDays() {
  const form = document.getElementById("payrollForm");
  const month = Number(form.payMonth.value);
  const year = Number(form.payYear.value);
  if (!month || !year) return 0;
  return new Date(year, month, 0).getDate();
}

function getSelectedPayrollMonthKey() {
  const form = document.getElementById("payrollForm");
  return `${form.payMonth.value}-${form.payYear.value}`;
}

function getAbsenceSummary() {
  if (!selectedPayrollWorker) return { days: 0, expectedAmount: 0 };

  const form = document.getElementById("payrollForm");
  const selectedMonth = Number(form.payMonth.value);
  const selectedYear = Number(form.payYear.value);
  let days = 0;
  let expectedAmount = 0;

  payrollAdvances.forEach(item => {
    if (String(item["工人编号"]) !== String(selectedPayrollWorker["工人编号"])) return;
    if (String(item["项目"] || item["类型"]) !== "缺席") return;

    const date = parsePayrollDate(item["日期时间"] || item["日期"] || item["扣款日期"]);
    if (!date || date.getMonth() + 1 !== selectedMonth || date.getFullYear() !== selectedYear) return;

    days += 1;
    expectedAmount += parsePayrollMoney(item["金额"]);
  });

  return { days, expectedAmount };
}

function renderAbsenceSection() {
  const summary = getAbsenceSummary();
  document.getElementById("absenceDaysText").textContent = `本月 ${formatDayCount(summary.days)} 天`;
  document.getElementById("absenceAmountText").textContent = formatPayrollCurrency(summary.expectedAmount);
  document.getElementById("absenceNote").textContent = summary.days > 0
    ? "选择“免扣”仍会保存缺席天数，但本月不扣薪。"
    : "没有缺席记录。";
}

function getCurrentMonthPayrollRecord() {
  if (!selectedPayrollWorker) return null;
  const monthKey = normalizePayrollMonth(getSelectedPayrollMonthKey());
  const form = document.getElementById("payrollForm");
  return payrollRecords.find(item =>
    String(item["公司"] || "") === String(form.company.value || "") &&
    String(item["工人编号"] || "") === String(selectedPayrollWorker["工人编号"] || "") &&
    normalizePayrollMonth(item["月份"]) === monthKey
  ) || null;
}

function normalizeDebtType(type) {
  const text = String(type || "").trim();
  return text === "其他" || text === "医疗" ? "支粮" : text;
}

function getSelectedPayrollCutoffDate() {
  const form = document.getElementById("payrollForm");
  const month = Number(form?.payMonth?.value || 0);
  const year = Number(form?.payYear?.value || 0);
  if (!month || !year) return null;
  return new Date(year, month, 0, 23, 59, 59, 999);
}

function getEligibleDebtSourceRecords(type) {
  if (!selectedPayrollWorker) return [];
  const workerNo = String(selectedPayrollWorker["工人编号"] || "");
  const company = String(selectedPayrollWorker["公司"] || "");
  const normalizedType = normalizeDebtType(type);
  const cutoff = getSelectedPayrollCutoffDate();

  return payrollAdvances
    .filter(item => {
      if (String(item["工人编号"] || "") !== workerNo) return false;
      if (company && String(item["公司"] || "") !== company) return false;
      if (normalizeDebtType(item["项目"] || item["类型"]) !== normalizedType) return false;
      if (parsePayrollMoney(item["金额"]) <= 0) return false;
      const date = parsePayrollDate(item["日期时间"] || item["日期"] || item["扣款日期"]);
      return !cutoff || (date && date.getTime() <= cutoff.getTime());
    })
    .sort((a, b) => debtDateNumber(b["日期时间"] || b["日期"]) - debtDateNumber(a["日期时间"] || a["日期"]));
}

function getPriorPayrollRecords() {
  if (!selectedPayrollWorker) return [];
  const selectedMonthNumber = payrollMonthToNumber(getSelectedPayrollMonthKey());
  const workerNo = String(selectedPayrollWorker["工人编号"] || "");
  const company = String(selectedPayrollWorker["公司"] || "");

  return payrollRecords.filter(item =>
    String(item["工人编号"] || "") === workerNo &&
    (!company || String(item["公司"] || "") === company) &&
    payrollMonthToNumber(item["月份"]) < selectedMonthNumber
  );
}

function buildDebtRecordStates(type) {
  const records = getEligibleDebtSourceRecords(type);
  const deductedByKey = new Map();
  let legacyTotal = 0;

  getPriorPayrollRecords().forEach(payroll => {
    let allocations = [];
    try {
      allocations = JSON.parse(String(payroll["扣款明细JSON"] || "[]"));
    } catch (_) {
      allocations = [];
    }

    const matching = Array.isArray(allocations)
      ? allocations.filter(entry => normalizeDebtType(entry.type) === normalizeDebtType(type))
      : [];

    if (matching.length) {
      matching.forEach(entry => {
        const key = String(entry.key || "");
        const amount = parsePayrollMoney(entry.deducted);
        if (key && amount > 0) deductedByKey.set(key, (deductedByKey.get(key) || 0) + amount);
      });
    } else {
      legacyTotal += normalizeDebtType(type) === "支粮"
        ? parsePayrollMoney(payroll["支粮扣款"]) + parsePayrollMoney(payroll["欠款其他扣款"]) + parsePayrollMoney(payroll["医疗扣款"])
        : parsePayrollMoney(payroll["准证扣款"]);
    }
  });

  const states = records.map((item, index) => {
    const key = payrollDebtRecordKey(item, index);
    const originalAmount = parsePayrollMoney(item["金额"]);
    const priorDeducted = Math.min(originalAmount, deductedByKey.get(key) || 0);
    return {
      ...item,
      _debtKey: key,
      _originalAmount: originalAmount,
      _priorDeducted: priorDeducted,
      _remaining: Math.max(0, originalAmount - priorDeducted)
    };
  });

  // 兼容旧版没有逐笔 JSON 的 Payroll，按日期由新到旧冲销。
  states.forEach(item => {
    if (legacyTotal <= 0 || item._remaining <= 0) return;
    const applied = Math.min(item._remaining, legacyTotal);
    item._priorDeducted += applied;
    item._remaining -= applied;
    legacyTotal -= applied;
  });

  return states;
}

function getOutstandingByType(workerNo) {
  const totals = Object.fromEntries(DEBT_TYPES.map(type => [type, 0]));
  if (!selectedPayrollWorker || String(selectedPayrollWorker["工人编号"] || "") !== String(workerNo || "")) return totals;

  DEBT_TYPES.forEach(type => {
    totals[type] = buildDebtRecordStates(type).reduce((sum, item) => sum + item._remaining, 0);
  });
  return totals;
}

function getDebtDeductionRemark(type, deductionAmount) {
  if (!selectedPayrollWorker || deductionAmount <= 0) return "";
  const normalizedType = normalizeDebtType(type);
  const remarks = payrollAdvances
    .filter(item =>
      String(item["工人编号"] || "") === String(selectedPayrollWorker["工人编号"]) &&
      normalizeDebtType(item["项目"] || item["类型"]) === normalizedType &&
      parsePayrollMoney(item["金额"]) > 0
    )
    .map(item => String(item["备注"] || "").trim())
    .filter(Boolean);
  return [...new Set(remarks)].join(" / ");
}

function getDebtOriginalNoteField(type) {
  const current = getCurrentMonthPayrollRecord();
  const savedFields = {
    "支粮": "支粮扣款说明",
    "准证": ""
  };

  // 新月份还没有 Payroll 时，必须保持空白。
  // 不读取旧月份画面中的扣款输入框，避免备注被带到新月份。
  if (!current) return "";

  const field = savedFields[type];
  return String(
    field && current && current[field]
      ? current[field]
      : ""
  ).trim();
}

function getDebtMalayNoteField(type) {
  const current = getCurrentMonthPayrollRecord();
  const savedFields = {
    "支粮": "支粮马来文说明",
    "准证": ""
  };

  const field = savedFields[type];
  return String(
    field && current && current[field]
      ? current[field]
      : ""
  ).trim();
}

function getDebtNoteInput(type, language) {
  return document.querySelector(
    `.debt-note-input[data-type="${type}"][data-language="${language}"]`
  );
}

async function fillMissingMalayDebtNotes() {
  const runId = ++payrollRemarkTranslationRun;
  const jobs = [];

  ["支粮"].forEach(type => {
    const originalInput = getDebtNoteInput(type, "source");
    const malayInput = getDebtNoteInput(type, "ms");

    if (!originalInput || !malayInput) return;

    const original = String(originalInput.value || "").trim();
    const malay = String(malayInput.value || "").trim();

    if (!original || malay) return;

    if (payrollRemarkTranslationCache.has(original)) {
      malayInput.value = payrollRemarkTranslationCache.get(original);
      return;
    }

    jobs.push({ type, text: original });
  });

  if (!jobs.length) return;

  try {
    const result = await api("translatePayrollRemarks", {
      remarks: jobs.map(job => job.text)
    });

    if (runId !== payrollRemarkTranslationRun) return;

    const translations = Array.isArray(result) ? result : [];

    jobs.forEach((job, index) => {
      const translated = String(translations[index] || "").trim();
      if (!translated) return;

      payrollRemarkTranslationCache.set(job.text, translated);

      const originalInput = getDebtNoteInput(job.type, "source");
      const malayInput = getDebtNoteInput(job.type, "ms");

      if (
        originalInput &&
        malayInput &&
        String(originalInput.value || "").trim() === job.text &&
        !String(malayInput.value || "").trim()
      ) {
        malayInput.value = translated;
      }
    });
  } catch (_) {
    // 翻译失败不影响 Payroll 计算或保存，管理员仍可手动填写马来文。
  }
}


function getWorkerDebtRecords(type) {
  const current = getCurrentMonthPayrollRecord();
  const savedKeys = new Set(parseSavedDebtAllocations(current)
    .filter(item => normalizeDebtType(item.type) === normalizeDebtType(type))
    .map(item => String(item.key || ""))
    .filter(Boolean));

  return buildDebtRecordStates(type).filter(item =>
    item._remaining > 0.005 || savedKeys.has(item._debtKey)
  );
}

function debtDateNumber(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? Number(match[3] + match[2] + match[1]) : 0;
}

function payrollDebtRecordKey(item, index) {
  const date = String(item["日期时间"] || item["日期"] || "").trim();
  const type = normalizeDebtType(item["项目"] || item["类型"]);
  const amount = parsePayrollMoney(item["金额"]);
  const row = Number(item.row) || 0;
  return [date, type, amount.toFixed(2), row || index + 1].join("|");
}

function parseSavedDebtAllocations(record) {
  if (!record) return [];
  try {
    const parsed = JSON.parse(String(record["扣款明细JSON"] || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function getSavedAllocationMap(type, current, records, legacyTotal) {
  const map = {};
  const saved = parseSavedDebtAllocations(current)
    .filter(item => normalizeDebtType(item.type) === normalizeDebtType(type));

  saved.forEach(item => {
    const key = String(item.key || "");
    const deducted = parsePayrollMoney(item.deducted);
    if (key && deducted > 0) map[key] = deducted;
  });

  // 兼容旧 Payroll：旧记录只有项目总扣款，没有逐笔明细。
  // 第一次打开时按日期由新到旧自动分配，管理员仍可逐笔修改。
  if (!saved.length && legacyTotal > 0) {
    let remaining = legacyTotal;
    records.forEach((item, index) => {
      if (remaining <= 0) return;
      const balance = parsePayrollMoney(item["金额"]);
      const deducted = Math.min(balance, remaining);
      if (deducted > 0) {
        map[payrollDebtRecordKey(item, index)] = deducted;
        remaining -= deducted;
      }
    });
  }

  return map;
}

function validateDebtRecordLimit(input, correctValue = false) {
  if (!input) return true;

  const itemBalance = Math.max(0, Number(input.dataset.itemBalance) || 0);
  const deduction = parsePayrollMoney(input.value);
  const valid = deduction <= itemBalance;
  const message = `本月扣除不能超过该笔欠款余额 ${formatPayrollCurrency(itemBalance)}`;

  input.classList.toggle("input-error", !valid);
  input.setCustomValidity(valid ? "" : message);

  if (!valid) {
    showStatus("status", message, false);

    // 离开输入框时只提醒一次，并自动改为该笔最高可扣金额。
    if (correctValue) {
      const alertKey = `${input.dataset.recordKey || ""}|${deduction}|${itemBalance}`;
      if (input.dataset.lastLimitAlert !== alertKey) {
        input.dataset.lastLimitAlert = alertKey;
        window.alert(message);
      }
      input.value = itemBalance > 0 ? moneyInput(itemBalance) : "";
      input.classList.remove("input-error");
      input.setCustomValidity("");
      return true;
    }
  } else {
    delete input.dataset.lastLimitAlert;
  }

  return valid;
}

function renderDebtRecordDetails(type, totalBalance, current, legacyTotal) {
  const records = getWorkerDebtRecords(type);
  if (!records.length) {
    return '<div class="debt-record-details"><div class="muted">没有欠款记录</div></div>';
  }

  const savedMap = getSavedAllocationMap(type, current, records, legacyTotal);
  let previousMonth = "";

  const rows = records.map((item, index) => {
    const date = String(item["日期时间"] || item["日期"] || "").trim();
    const month = date.length >= 10 ? date.substring(3, 10) : "";
    const spacer = previousMonth && month && month !== previousMonth
      ? '<div class="debt-record-month-gap"></div>'
      : "";
    previousMonth = month;

    const itemType = normalizeDebtType(item["项目"] || item["类型"]);
    const balance = Math.max(0, parsePayrollMoney(item._remaining));
    const key = String(item._debtKey || payrollDebtRecordKey(item, index));
    const savedValue = Math.min(parsePayrollMoney(savedMap[key]), balance);

    return `${spacer}
      <div class="debt-record-line debt-record-select-line">
        <div class="debt-record-text">
          <span>${escapePayrollHtml(date)} · ${escapePayrollHtml(itemType)} · 未清 ${formatPayrollCurrency(balance)}</span>
          ${item["备注"] ? `<small>${escapePayrollHtml(item["备注"])}</small>` : ""}
        </div>
        <input
          class="debt-record-deduction-input money-right"
          data-type="${escapePayrollHtml(itemType)}"
          data-record-key="${escapePayrollHtml(key)}"
          data-date="${escapePayrollHtml(date)}"
          data-item-balance="${balance}"
          data-remark="${escapePayrollHtml(item["备注"] || "")}"
          data-limit-message="本月扣除不能超过该笔欠款余额 ${formatPayrollCurrency(balance)}"
          type="text"
          inputmode="decimal"
          placeholder="0.00"
          value="${savedValue > 0 ? moneyInput(savedValue) : ""}"
        />
      </div>`;
  }).join("");

  return `
    <div class="debt-record-details">
      ${rows}
      <div class="debt-record-total">累计欠款：${formatPayrollCurrency(totalBalance)}</div>
    </div>`;
}

function renderDebtList() {
  const list = document.getElementById("debtList");
  if (!selectedPayrollWorker) return;

  const balances = getOutstandingByType(selectedPayrollWorker["工人编号"]);
  const current = getCurrentMonthPayrollRecord();
  const saved = {
    "支粮":
      parsePayrollMoney(current && current["支粮扣款"]) +
      parsePayrollMoney(current && current["欠款其他扣款"]) +
      parsePayrollMoney(current && current["医疗扣款"]),
    "准证": parsePayrollMoney(current && current["准证扣款"])
  };

  list.innerHTML = DEBT_TYPES.map(type => {
    const balance = balances[type] || 0;
    const value = Math.min(saved[type] || 0, balance);
    const isAdvance = type === "支粮";
    const remaining = Math.max(0, balance - value);
    const hasDebt = balance > 0;

    // V3.3：恢复 V2.9 较醒目的项目摘要，但保留 V3.3 的逐笔扣款上限验证。
    return `
      <div class="debt-row ${isAdvance ? "debt-row-with-notes" : ""} ${hasDebt ? "has-debt" : ""}">
        <div class="debt-info">
          <div class="debt-type">${type}</div>
          <div class="debt-balance">余额 ${formatPayrollCurrency(balance)}</div>
          <div class="debt-remaining ${remaining > 0 ? "debt-alert" : ""}" data-remaining-type="${type}">扣后剩余 ${formatPayrollCurrency(remaining)}</div>
        </div>

        ${renderDebtRecordDetails(type, balance, current, value)}

        <div class="debt-type-deduction-summary">
          <span>本月扣除：</span><strong data-deduction-type-total="${type}">${formatPayrollCurrency(value)}</strong>
        </div>
      </div>
    `;
  }).join("");

  applyPayrollMobileReadonlyMode();

  if (current) {
    const form = document.getElementById("payrollForm");
    const action = String(current["缺席处理"] || "扣薪");
    const radio = document.querySelector(`input[name="absenceAction"][value="${action}"]`);
    if (radio) radio.checked = true;

    const allowanceInput = getAllowanceInput(form);
    if (allowanceInput) {
      const savedAllowance = parsePayrollMoney(current["津贴"]);
      allowanceInput.value = savedAllowance > 0 ? moneyInput(savedAllowance) : "";
    }

    const liveCommissionInput = getLiveCommissionInput(form);
    if (liveCommissionInput) {
      const savedLiveCommission = parsePayrollMoney(current["直播佣金"]);
      liveCommissionInput.value = savedLiveCommission > 0
        ? moneyInput(savedLiveCommission)
        : "";
    }

    form.remark.value = String(current["备注"] || "");
    showStatus("status", "正在编辑已保存的 Payroll", true);
  } else {
    const form = document.getElementById("payrollForm");
    const allowanceInput = getAllowanceInput(form);
    if (allowanceInput) {
      const defaultAllowance = parsePayrollMoney(selectedPayrollWorker?.["默认津贴"]);
      allowanceInput.value = defaultAllowance > 0 ? moneyInput(defaultAllowance) : "";
    }

    const liveCommissionInput = getLiveCommissionInput(form);
    if (liveCommissionInput) liveCommissionInput.value = "";

    const defaultAbsenceAction = form.querySelector('input[name="absenceAction"][value="扣薪"]');
    if (defaultAbsenceAction) defaultAbsenceAction.checked = true;
    form.remark.value = "";
  }
}

function getAllowanceInput(form = document.getElementById("payrollForm")) {
  if (!form) return null;
  return form.elements.allowance || document.getElementById("allowance");
}

function getAllowanceAmount() {
  const input = getAllowanceInput();
  return input ? parsePayrollMoney(input.value) : 0;
}

function getLiveCommissionInput(form = document.getElementById("payrollForm")) {
  if (!form) return null;
  return form.elements.liveCommission || document.getElementById("liveCommission");
}

function getLiveCommissionAmount() {
  const input = getLiveCommissionInput();
  return input ? parsePayrollMoney(input.value) : 0;
}

function calculatePayroll() {
  const form = document.getElementById("payrollForm");
  if (!form || !selectedPayrollWorker) {
    const zero = "RM 0.00";
    const totalBox = document.getElementById("totalDeductionText");
    const netBox = document.getElementById("netSalaryText");
    const debtBox = document.getElementById("remainingDebtText");
    if (totalBox) totalBox.textContent = zero;
    if (netBox) netBox.textContent = zero;
    if (debtBox) debtBox.textContent = zero;
    return {
      grossSalary: 0,
      allowance: 0,
      liveCommission: 0,
      absence: { days: 0, expectedAmount: 0 },
      absenceAction: "扣薪",
      absenceDeduction: 0,
      totalDeduction: 0,
      netSalary: 0,
      remainingDebt: 0,
      invalidDeduction: false
    };
  }

  const grossSalary = getGrossSalary();
  const allowance = getAllowanceAmount();
  const liveCommission = getLiveCommissionAmount();
  const absence = getAbsenceSummary();
  const absenceAction = form.querySelector('input[name="absenceAction"]:checked')?.value || "扣薪";
  const absenceDeduction = absenceAction === "扣薪" ? absence.expectedAmount : 0;

  let debtDeduction = 0;
  let totalOutstanding = 0;
  let invalidDeduction = false;

  const balancesByType = getOutstandingByType(selectedPayrollWorker["工人编号"]);
  const deductionsByType = Object.fromEntries(DEBT_TYPES.map(type => [type, 0]));

  document.querySelectorAll(".debt-record-deduction-input").forEach(input => {
    const itemBalance = Number(input.dataset.itemBalance) || 0;
    const deduction = parsePayrollMoney(input.value);
    const type = normalizeDebtType(input.dataset.type);

    debtDeduction += deduction;
    deductionsByType[type] = (deductionsByType[type] || 0) + deduction;
    if (!validateDebtRecordLimit(input, false)) invalidDeduction = true;
  });

  DEBT_TYPES.forEach(type => {
    const balance = Number(balancesByType[type]) || 0;
    const deduction = Number(deductionsByType[type]) || 0;
    const remaining = Math.max(0, balance - deduction);
    totalOutstanding += balance;

    const remainingBox = document.querySelector(`[data-remaining-type="${type}"]`);
    if (remainingBox) {
      remainingBox.textContent = `扣后剩余 ${formatPayrollCurrency(remaining)}`;
      remainingBox.classList.toggle("debt-alert", remaining > 0);
    }

    const totalBox = document.querySelector(`[data-deduction-type-total="${type}"]`);
    if (totalBox) totalBox.textContent = formatPayrollCurrency(deduction);
  });

  document.getElementById("absenceAmountText").textContent = formatPayrollCurrency(absenceDeduction);

  const totalDeduction = absenceDeduction + debtDeduction;
  const netSalary = Math.max(
    0,
    grossSalary + allowance + liveCommission - totalDeduction
  );
  const remainingDebt = Math.max(0, totalOutstanding - debtDeduction);

  document.getElementById("totalDeductionText").textContent = formatPayrollCurrency(totalDeduction);
  document.getElementById("netSalaryText").textContent = formatPayrollCurrency(netSalary);
  const remainingDebtText = document.getElementById("remainingDebtText");
  remainingDebtText.textContent = formatPayrollCurrency(remainingDebt);
  remainingDebtText.classList.toggle("debt-alert", remainingDebt > 0);

  return {
    grossSalary,
    allowance,
    liveCommission,
    absence,
    absenceAction,
    absenceDeduction,
    debtDeduction,
    totalDeduction,
    netSalary,
    remainingDebt,
    invalidDeduction
  };
}


function prepareDebtAllocationRemarks(details) {
  const items = Array.isArray(details) ? details : [];
  const fallbackMap = {
    "买手机": "Membeli telefon bimbit",
    "回家乡": "Pulang ke kampung halaman"
  };

  return items.map(item => {
    const source = String(item.remark || "").trim();

    return {
      ...item,
      // 每一笔扣款只保存自己对应的备注。
      // 没有备注的项目保持空白，不会套用其他日期的备注。
      malayRemark: source ? String(fallbackMap[source] || "").trim() : ""
    };
  });
}

function getPayrollPaymentDate() {
  const form = document.getElementById("payrollForm");
  const month = Number(form?.payMonth?.value || 0);
  const year = Number(form?.payYear?.value || 0);
  if (!month || !year) return formatDateDDMMYYYY(new Date());

  // V4.0：Payment Date 不能早于工资月份的次月 1 日；
  // 如果实际处理 Payroll 时已经超过 1 日，则使用当天日期。
  // 例如：31/08 准备 08-2026 -> 01-09-2026；02/09 准备 -> 02-09-2026。
  const scheduledDate = new Date(year, month, 1);
  scheduledDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const paymentDate = today > scheduledDate ? today : scheduledDate;
  return formatDateDDMMYYYY(paymentDate);
}

async function handlePayrollSubmit(event) {
  event.preventDefault();

  if (isPayrollMobileReadonly()) {
    showPayrollDesktopOnlyMessage();
    return;
  }

  const form = event.target;
  const btn = document.getElementById("savePayrollBtn");

  if (!selectedPayrollWorker) {
    showStatus("status", "请选择工人", false);
    return;
  }

  try {
    if (editingPayrollOriginalKey) {
      const currentMonth = getSelectedPayrollMonthKey();
      if (
        String(form.company.value || "") !== String(editingPayrollOriginalKey.company || "") ||
        String(selectedPayrollWorker?.["工人编号"] || "") !== String(editingPayrollOriginalKey.workerNo || "") ||
        normalizePayrollMonth(currentMonth) !== normalizePayrollMonth(editingPayrollOriginalKey.month)
      ) {
        throw new Error("编辑 Payroll 时不能修改公司、工人或月份。请删除后重新建立。");
      }
    }

    const existingPayroll = getCurrentMonthPayrollRecord();

    if (!editingPayrollOriginalKey && existingPayroll) {
      window.alert("这份 Payroll 已经保存，不能重复保存。请到下面的 Payroll 列表点击‘编辑 Payroll’后再修改。");
      return;
    }

    if (
      editingPayrollOriginalKey &&
      String(existingPayroll?.["已打印"] || "").trim() === "是"
    ) {
      const confirmed = window.confirm(
        "这份工资单已经打印，薪水可能已经发放。确认要修改吗？"
      );
      if (!confirmed) return;
    }

    const calculation = calculatePayroll();
    if (String(selectedPayrollWorker["薪水类型"] || "") === "日薪" && getWorkDays() <= 0) {
      throw new Error("请输入本月计薪天数");
    }
    if (calculation.grossSalary <= 0) throw new Error("本月工资必须大于 0");
    if (calculation.invalidDeduction) {
      const invalidInput = [...document.querySelectorAll(".debt-record-deduction-input")]
        .find(input => parsePayrollMoney(input.value) > (Number(input.dataset.itemBalance) || 0));
      const limit = Number(invalidInput?.dataset.itemBalance) || 0;
      throw new Error(`本月扣除不能超过该笔欠款余额 ${formatPayrollCurrency(limit)}`);
    }
    if (
      calculation.totalDeduction >
      calculation.grossSalary + calculation.allowance + calculation.liveCommission
    ) {
      throw new Error("总扣款不能超过本月工资、津贴和直播佣金总额");
    }

    const deductions = Object.fromEntries(DEBT_TYPES.map(type => [type, 0]));
    const debtAllocationDetails = [];

    document.querySelectorAll(".debt-record-deduction-input").forEach(input => {
      const deducted = parsePayrollMoney(input.value);
      const type = normalizeDebtType(input.dataset.type);
      deductions[type] = (deductions[type] || 0) + deducted;

      if (deducted > 0) {
        debtAllocationDetails.push({
          key: String(input.dataset.recordKey || ""),
          date: String(input.dataset.date || ""),
          type,
          originalAmount: Number(input.dataset.itemBalance) || 0,
          deducted,
          remark: String(input.dataset.remark || "")
        });
      }
    });

    const translatedDebtAllocationDetails = prepareDebtAllocationRemarks(debtAllocationDetails);

    const salaryType = String(selectedPayrollWorker["薪水类型"] || "");
    const payroll = {
      payDate: getPayrollPaymentDate(),
      month: getSelectedPayrollMonthKey(),
      company: form.company.value,
      workerNo: selectedPayrollWorker["工人编号"],
      workerName: selectedPayrollWorker["工人名字"],
      salaryType,
      workDays: salaryType === "日薪" ? getWorkDays() : 0,
      salaryRate: parsePayrollMoney(selectedPayrollWorker["日薪"]),
      monthlySalary: parsePayrollMoney(selectedPayrollWorker["月薪"]),
      basicSalary: calculation.grossSalary,
      allowance: calculation.allowance,
      updateDefaultAllowance: parsePayrollMoney(selectedPayrollWorker?.["默认津贴"]) !== calculation.allowance,
      confirmPrintedUpdate: Boolean(editingPayrollOriginalKey),
      liveCommission: calculation.liveCommission,
      absenceDays: calculation.absence.days,
      absenceAction: calculation.absenceAction,
      absenceExpectedAmount: calculation.absence.expectedAmount,
      absenceDeduction: calculation.absenceDeduction,
      advanceDeduction: deductions["支粮"] || 0,
      advanceDeductionRemark: "",
      advanceDeductionMalayRemark: "",
      permitDeduction: deductions["准证"] || 0,
      permitDeductionRemark: "",
      permitDeductionMalayRemark: "",
      medicalDeduction: 0,
      debtOtherDeduction: 0,
      debtOtherDeductionRemark: "",
      debtOtherDeductionMalayRemark: "",
      otherPayrollDeduction: 0,
      totalDeduction: calculation.totalDeduction,
      netSalary: calculation.netSalary,
      debtBalance: calculation.remainingDebt,
      debtAllocationJson: JSON.stringify(translatedDebtAllocationDetails),
      remark: form.remark.value.trim(),
      originalCompany: editingPayrollOriginalKey?.company || "",
      originalWorkerNo: editingPayrollOriginalKey?.workerNo || "",
      originalMonth: editingPayrollOriginalKey?.month || "",
      clientDevice: isPayrollMobileReadonly() ? "mobile" : "desktop"
    };

    btn.disabled = true;
    btn.textContent = "保存中...";

    const result = await api("savePayroll", { payroll });

    const keyMonth = normalizePayrollMonth(payroll.month);
    const keyCompany = String(payroll.company || "");
    const keyWorker = String(payroll.workerNo || "");

    if (result && result.deleted) {
      payrollRecords = payrollRecords.filter(item =>
        !(
          String(item["公司"] || "") === keyCompany &&
          normalizePayrollMonth(item["月份"]) === keyMonth &&
          String(item["工人编号"] || "") === keyWorker
        )
      );

      showStatus(
        "status",
        "Payroll 已恢复原状，记录已从 Google Sheet 删除",
        true
      );

      if (typeof setApiCachedData === "function") {
        setApiCachedData("getPayrollBootstrap", {}, {
          workers: payrollWorkers,
          advances: payrollAdvances,
          payrolls: payrollRecords
        });
      }

      renderPayrollHistory();
      renderDebtList();
      calculatePayroll();
      return;
    }

    showStatus(
      "status",
      result && result.updated ? "Payroll 已更新" : "Payroll 已保存",
      true
    );

    const savedRecord = result && result.record ? result.record : {
      "发薪日期": payroll.payDate,
      "月份": payroll.month,
      "公司": payroll.company,
      "工人编号": payroll.workerNo,
      "工人名字": payroll.workerName,
      "薪水类型": payroll.salaryType,
      "工作天数": payroll.workDays,
      "日薪": payroll.salaryRate,
      "月薪": payroll.monthlySalary,
      "基本薪水": payroll.basicSalary,
      "津贴": payroll.allowance,
      "直播佣金": payroll.liveCommission,
      "缺席天数": payroll.absenceDays,
      "缺席处理": payroll.absenceAction,
      "缺席应扣金额": payroll.absenceExpectedAmount,
      "缺席扣款": payroll.absenceDeduction,
      "支粮扣款": payroll.advanceDeduction,
      "支粮扣款说明": payroll.advanceDeductionRemark,
      "支粮马来文说明": payroll.advanceDeductionMalayRemark,
      "准证扣款": payroll.permitDeduction,
      "准证扣款说明": "",
      "准证马来文说明": "",
      "医疗扣款": 0,
      "欠款其他扣款": 0,
      "其他扣款说明": "",
      "其他马来文说明": "",
      "其他工资扣款": payroll.otherPayrollDeduction,
      "总扣款": payroll.totalDeduction,
      "实发薪水": payroll.netSalary,
      "欠款余额": payroll.debtBalance,
      "扣款明细JSON": payroll.debtAllocationJson,
      "备注": payroll.remark
    };

    const savedAllowance = parsePayrollMoney(payroll.allowance);

    if (selectedPayrollWorker) {
      selectedPayrollWorker["默认津贴"] = savedAllowance;
    }

    const workerIndex = payrollWorkers.findIndex(worker =>
      String(worker["工人编号"] || "") === String(payroll.workerNo || "")
    );

    if (workerIndex >= 0) {
      payrollWorkers[workerIndex]["默认津贴"] = savedAllowance;
    }

    if (editingPayrollOriginalKey) {
      const original = editingPayrollOriginalKey;
      payrollRecords = payrollRecords.filter(item => !(
        String(item["公司"] || "") === String(original.company || "") &&
        normalizePayrollMonth(item["月份"]) === normalizePayrollMonth(original.month) &&
        String(item["工人编号"] || "") === String(original.workerNo || "")
      ));
      editingPayrollOriginalKey = null;
      btn.textContent = "保存 Payroll";
    }

    const index = payrollRecords.findIndex(item =>
      String(item["公司"] || "") === String(savedRecord["公司"] || "") &&
      normalizePayrollMonth(item["月份"]) ===
        normalizePayrollMonth(savedRecord["月份"]) &&
      String(item["工人编号"] || "") ===
        String(savedRecord["工人编号"] || "")
    );

    if (index >= 0) payrollRecords[index] = savedRecord;
    else payrollRecords.push(savedRecord);

    if (typeof setApiCachedData === "function") {
      setApiCachedData("getPayrollBootstrap", {}, {
        workers: payrollWorkers,
        advances: payrollAdvances,
        payrolls: payrollRecords
      });
    }

    renderPayrollHistory();
    renderDebtList();
    calculatePayroll();
  } catch (error) {
    showStatus("status", error.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = "保存 Payroll";
  }
}

function renderPayrollHistory() {
  const list = document.getElementById("payrollList");
  if (!payrollRecords.length) {
    list.innerHTML = '<p class="muted">还没有 Payroll 记录。</p>';
    return;
  }

  const selectedMonth = normalizePayrollMonth(getSelectedPayrollMonthKey());
  const sorted = [...payrollRecords].sort(comparePayrollRecords);
  const currentMonthRecords = sorted.filter(item =>
    normalizePayrollMonth(item["月份"]) === selectedMonth
  );

  if (!currentMonthRecords.length) {
    list.innerHTML = `<p class="muted">${escapePayrollHtml(selectedMonth)} 这个月份还没有 Payroll 记录。</p>`;
    return;
  }

  const totalNetSalary = currentMonthRecords.reduce(
    (sum, item) => sum + parsePayrollMoney(item["实发薪水"]),
    0
  );
  const totalDeductionSalary = currentMonthRecords.reduce(
    (sum, item) => sum + parsePayrollMoney(item["总扣款"]),
    0
  );
  // V4.11：工资总数只从已经保存的 Payroll 快照计算，避免重新套用当前工资/欠款逻辑。
  const totalGrossSalary = totalNetSalary + totalDeductionSalary;

  const recordsHtml = currentMonthRecords.map(item => {
   const absenceDays = Number(item["缺席天数"]) || 0;
const allowance = parsePayrollMoney(item["津贴"]);
const liveCommission = parsePayrollMoney(item["直播佣金"]);
const totalDeduction = parsePayrollMoney(item["总扣款"]);
const debtBalance = parsePayrollMoney(item["欠款余额"]);
const summaryParts = [];

    if (absenceDays > 0) {
      summaryParts.push(`缺席 ${formatDayCount(absenceDays)} 天`);
      summaryParts.push(escapePayrollHtml(item["缺席处理"] || "扣薪"));
    }

    if (totalDeduction > 0) {
      summaryParts.push(`总扣款 : ${formatPayrollCurrency(totalDeduction)}`);
    }

    return `
      <div class="record-item payroll-record-item">
        <div class="worker-name">${escapePayrollHtml(item["工人编号"])} · ${escapePayrollHtml(item["工人名字"])} · ${escapePayrollHtml(item["公司"] || "")}</div>
        <div class="muted">${escapePayrollHtml(normalizePayrollMonth(item["月份"]))} · 本月工资 : ${formatPayrollCurrency(item["基本薪水"])}</div>
       ${allowance > 0 ? `<div class="muted">津贴 : ${formatPayrollCurrency(allowance)}</div>` : ""}
      ${liveCommission > 0 ? `<div class="muted">直播佣金 : ${formatPayrollCurrency(liveCommission)}</div>` : ""}
      ${absenceDays > 0 ? `<div class="muted payroll-record-summary">缺席 ${formatDayCount(absenceDays)} 天 · ${escapePayrollHtml(parsePayrollMoney(item["缺席扣款"]) > 0 ? "扣薪" : "免扣")}</div>` : ""}
      <div class="payroll-total-deduction-line"><span>本月扣款：</span><strong>${formatPayrollCurrency(totalDeduction)}</strong></div>
      <div class="payroll-debt-balance-line"><span>累计欠款：</span><strong>${formatPayrollCurrency(debtBalance)}</strong></div>
      <div class="payroll-net-line"><span>实发：</span><strong>${formatPayrollCurrency(item["实发薪水"])}</strong></div>
        <div class="payroll-record-actions">
          <button
            type="button"
            class="payroll-action-btn payroll-edit-btn"
            onclick="editPayrollRecord('${escapePayrollJsString(item["公司"] || "")}', '${escapePayrollJsString(item["工人编号"] || "")}', '${escapePayrollJsString(normalizePayrollMonth(item["月份"]))}')"
          >编辑 Payroll</button>
          <button
            type="button"
            class="payroll-action-btn payroll-delete-btn"
            onclick="deletePayrollRecord('${escapePayrollJsString(item["公司"] || "")}', '${escapePayrollJsString(item["工人编号"] || "")}', '${escapePayrollJsString(normalizePayrollMonth(item["月份"]))}', '${escapePayrollJsString(item["工人名字"] || "")}')"
          >删除 Payroll</button>
          <a
            class="payslip-link"
            href="payslip.html?company=${encodeURIComponent(String(item["公司"] || ""))}&workerNo=${encodeURIComponent(String(item["工人编号"] || ""))}&month=${encodeURIComponent(normalizePayrollMonth(item["月份"]))}"
            onclick="savePayrollSelection('${escapePayrollJsString(item["公司"] || "")}', '${escapePayrollJsString(item["工人编号"] || "")}')"
          >打印工资单 / Print Payslip</a>
        </div>
      </div>
    `;
  }).join("");

  const totalHtml = `
    <div class="payroll-total-card payroll-month-summary-card">
      <div class="payroll-total-title">${escapePayrollHtml(selectedMonth)} · 两间公司本月工资总数</div>
      <div class="payroll-total-amount">${formatPayrollCurrency(totalGrossSalary)}</div>
      <div class="payroll-month-summary-row payroll-month-deduction-row">
        <span>总共扣款</span>
        <strong>${formatPayrollCurrency(totalDeductionSalary)}</strong>
      </div>
      <div class="payroll-month-summary-row payroll-month-net-row">
        <span>实发工资总数</span>
        <strong>${formatPayrollCurrency(totalNetSalary)}</strong>
      </div>
    </div>
  `;

  list.innerHTML = recordsHtml + totalHtml;
  applyPayrollMobileReadonlyMode();
}



function setPayrollIdentityLocked(locked) {
  const form = document.getElementById("payrollForm");
  if (!form) return;

  ["payMonth", "payYear", "company", "workerNo"].forEach(name => {
    const field = form.elements[name];
    if (!field) return;
    // 电脑编辑旧 Payroll 时维持原有身份锁定；手机始终保留查询能力。
    field.disabled = isPayrollMobileReadonly() ? false : Boolean(locked);
  });

  form.dataset.identityLocked = locked ? "true" : "false";
}

function resetPayrollEditMode() {
  editingPayrollOriginalKey = null;
  setPayrollIdentityLocked(false);

  const button = document.getElementById("savePayrollBtn");
  if (button) button.textContent = "保存 Payroll";
}

async function editPayrollRecord(company, workerNo, month) {
  if (isPayrollMobileReadonly()) {
    showPayrollDesktopOnlyMessage();
    return;
  }

  const record = payrollRecords.find(item =>
    String(item["公司"] || "") === String(company || "") &&
    String(item["工人编号"] || "") === String(workerNo || "") &&
    normalizePayrollMonth(item["月份"]) === normalizePayrollMonth(month)
  );

  if (!record) {
    showStatus("status", "找不到这笔 Payroll", false);
    return;
  }

  const form = document.getElementById("payrollForm");
  const match = normalizePayrollMonth(month).match(/^(\d{2})-(\d{4})$/);
  if (!form || !match) return;

  editingPayrollOriginalKey = {
    company: String(company || ""),
    workerNo: String(workerNo || ""),
    month: normalizePayrollMonth(month)
  };

  form.payMonth.value = match[1];
  form.payYear.value = match[2];
  form.company.value = String(company || "");
  renderPayrollWorkers();

  let worker = payrollWorkers.find(item =>
    String(item["公司"] || "") === String(company || "") &&
    String(item["工人编号"] || "") === String(workerNo || "")
  );

  // 已离职工人不会出现在在职名单，编辑历史记录时临时建立选项。
  if (!worker) {
    worker = {
      "公司": record["公司"],
      "工人编号": record["工人编号"],
      "工人名字": record["工人名字"],
      "薪水类型": record["薪水类型"],
      "日薪": record["日薪"],
      "月薪": record["月薪"],
      "默认津贴": record["津贴"]
    };
    const option = document.createElement("option");
    option.value = String(workerNo || "");
    option.textContent = `${workerNo} · ${record["工人名字"]}（已离职）`;
    form.workerNo.appendChild(option);
  }

  selectedPayrollWorker = worker;
  form.workerNo.value = String(workerNo || "");
  form.salaryType.value = String(record["薪水类型"] || worker["薪水类型"] || "");

  // V2.3：编辑 Payroll 时锁定公司、工人和月份。
  // 若身份资料错误，应删除该笔 Payroll 后重新建立，避免影响其他工人或月份。
  setPayrollIdentityLocked(true);

  renderSalarySection();
  renderAbsenceSection();
  renderDebtList();
  calculatePayroll();

  const button = document.getElementById("savePayrollBtn");
  if (button) button.textContent = "更新 Payroll";
  showStatus("status", `正在编辑 ${month} · ${workerNo} 的 Payroll`, true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deletePayrollRecord(company, workerNo, month, workerName) {
  if (isPayrollMobileReadonly()) {
    showPayrollDesktopOnlyMessage();
    return;
  }

  const message = [
    "确定删除这笔 Payroll？",
    "",
    `工人：${workerNo} · ${workerName}`,
    `月份：${month}`,
    "",
    "此操作无法还原。"
  ].join("\n");

  if (!window.confirm(message)) return;

  try {
    showStatus("status", "正在删除 Payroll...", true);
    await api("deletePayroll", {
      key: { company, workerNo, month }
    });

    payrollRecords = payrollRecords.filter(item => !(
      String(item["公司"] || "") === String(company || "") &&
      String(item["工人编号"] || "") === String(workerNo || "") &&
      normalizePayrollMonth(item["月份"]) === normalizePayrollMonth(month)
    ));

    if (
      editingPayrollOriginalKey &&
      editingPayrollOriginalKey.company === company &&
      editingPayrollOriginalKey.workerNo === workerNo &&
      normalizePayrollMonth(editingPayrollOriginalKey.month) === normalizePayrollMonth(month)
    ) {
      editingPayrollOriginalKey = null;
      resetPayrollEntryFields();
      renderPayrollWorkers();
      const button = document.getElementById("savePayrollBtn");
      if (button) button.textContent = "保存 Payroll";
    }

    if (typeof setApiCachedData === "function") {
      setApiCachedData("getPayrollBootstrap", {}, {
        workers: payrollWorkers,
        advances: payrollAdvances,
        payrolls: payrollRecords
      });
    }

    renderPayrollHistory();
    showStatus("status", "Payroll 已删除", true);
  } catch (error) {
    showStatus("status", error.message, false);
  }
}

function savePayrollSelection(company, workerNo) {
  const form = document.getElementById("payrollForm");
  if (!form) return;

  sessionStorage.setItem("payrollCompany", String(company || ""));
  sessionStorage.setItem("payrollWorker", String(workerNo || ""));
  sessionStorage.setItem("payrollMonth", String(form.payMonth?.value || ""));
  sessionStorage.setItem("payrollYear", String(form.payYear?.value || ""));
}

function escapePayrollJsString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function comparePayrollRecords(a, b) {
  const companyA = COMPANY_ORDER[String(a["公司"] || "")] || 99;
  const companyB = COMPANY_ORDER[String(b["公司"] || "")] || 99;
  if (companyA !== companyB) return companyA - companyB;

  const workerCompare = String(a["工人编号"] || "").localeCompare(
    String(b["工人编号"] || ""), undefined, { numeric: true }
  );
  if (workerCompare !== 0) return workerCompare;

  return payrollMonthToNumber(a["月份"]) - payrollMonthToNumber(b["月份"]);
}

function payrollMonthToNumber(value) {
  const normalized = normalizePayrollMonth(value);
  const match = normalized.match(/^(\d{2})-(\d{4})$/);
  return match ? Number(match[2]) * 100 + Number(match[1]) : 0;
}

function normalizePayrollMonth(value) {
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
  if (!Number.isNaN(date.getTime())) {
    return `${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
  }
  return text;
}

function formatPayrollRecordDate(item) {
  const direct = item["发薪日期"];
  if (direct) return formatAnyDateDDMMYYYY(direct);

  const month = normalizePayrollMonth(item["月份"]);
  const match = month.match(/^(\d{2})-(\d{4})$/);
  if (!match) return "";
  const lastDay = new Date(Number(match[2]), Number(match[1]), 0).getDate();
  return `${String(lastDay).padStart(2, "0")}-${match[1]}-${match[2]}`;
}

function formatDateDDMMYYYY(date) {
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function formatAnyDateDDMMYYYY(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{2}-\d{2}-\d{4}/.test(text)) return text.substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [y, m, d] = text.substring(0, 10).split("-");
    return `${d}-${m}-${y}`;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : formatDateDDMMYYYY(date);
}

function parsePayrollDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{2}-\d{2}-\d{4}/.test(text)) {
    const [dd, mm, yyyy] = text.substring(0, 10).split("-").map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [yyyy, mm, dd] = text.substring(0, 10).split("-").map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  return null;
}

function formatDayCount(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function parsePayrollMoney(value) {
  return Number(String(value || "").replace(/[^\d.]/g, "")) || 0;
}

function moneyInput(value) {
  return (Number(value) || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPayrollCurrency(value) {
  return "RM " + moneyInput(value);
}

function escapePayrollHtml(value) {
  return String(value || "").replace(/[&<>"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[char]));
}



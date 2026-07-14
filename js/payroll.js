let payrollWorkers = [];
let payrollAdvances = [];
let payrollRecords = [];
let selectedPayrollWorker = null;

const DEBT_TYPES = ["支粮", "准证", "其他"];
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

  form.addEventListener("input", event => {
    if (
      event.target.classList.contains("debt-deduction-input") ||
      event.target.name === "allowance" ||
      event.target.id === "allowance"
    ) {
      calculatePayroll();
    }
  });

  form.addEventListener("focusout", event => {
    if (event.target.classList.contains("debt-deduction-input")) {
      if (event.target.value.trim()) event.target.value = moneyInput(event.target.value);
      calculatePayroll();
    }

    if (event.target.name === "allowance" || event.target.id === "allowance") {
  const value = parsePayrollMoney(event.target.value);

  event.target.value = value > 0
    ? moneyInput(value)
    : "";

  calculatePayroll();
}
  });
form.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target.name === "allowance") {
        event.preventDefault();
        event.target.blur();
    }
});
  form.addEventListener("submit", handlePayrollSubmit);
  loadPayrollPage();
});

async function loadPayrollPage() {
  try {
    const data = await api("getPayrollBootstrap");
    payrollWorkers = data?.workers || [];
    payrollAdvances = data?.advances || [];
    payrollRecords = data?.payrolls || [];

    renderPayrollWorkers();
    renderPayrollHistory();
    showStatus("status", "系统已就绪，可以计算 Payroll", true);
  } catch (error) {
    showStatus("status", error.message, false);
  }
}

function setupPayrollMonthYear() {
  const form = document.getElementById("payrollForm");
  const now = new Date();

  fillPayrollSelect(form.payMonth, 1, 12, "月");
  fillPayrollSelect(form.payYear, 2025, now.getFullYear() + 5, "年");

  form.payMonth.value = String(now.getMonth() + 1).padStart(2, "0");
  form.payYear.value = String(now.getFullYear());
}

function fillPayrollSelect(select, start, end, label) {
  select.innerHTML = `<option value="">${label}</option>`;
  for (let i = start; i <= end; i++) {
    const value = label === "年" ? String(i) : String(i).padStart(2, "0");
    select.innerHTML += `<option value="${value}">${value}</option>`;
  }
}


function handlePayrollCompanyChange() {
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

  try {
    await refreshPayrollSourceData();
    renderAbsenceSection();
    renderDebtList();
    calculatePayroll();
  } catch (error) {
    showStatus("status", error.message, false);
  }
}

async function handlePayrollPeriodChange() {
  if (!selectedPayrollWorker) return;

  // 月份改变后先即时重算工资，再读取最新扣款资料。
  renderSalarySection();
  renderAbsenceSection();
  renderDebtList();
  calculatePayroll();

  try {
    await refreshPayrollSourceData();
    renderAbsenceSection();
    renderDebtList();
    calculatePayroll();
  } catch (error) {
    showStatus("status", error.message, false);
  }
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
  const allowanceInput = getAllowanceInput(form);
  if (allowanceInput) allowanceInput.value = "";
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
  const gross = getGrossSalary();

  if (salaryType === "日薪") {
    dailyRow.style.display = "grid";
    monthlyRow.style.display = "none";
    form.salaryRateDisplay.value = moneyInput(selectedPayrollWorker["日薪"]);
    form.grossSalary.value = moneyInput(gross);
    form.monthlyGrossSalary.value = "";
  } else {
    dailyRow.style.display = "none";
    monthlyRow.style.display = "block";
    form.salaryRateDisplay.value = "";
    form.grossSalary.value = "";
    form.monthlyGrossSalary.value = moneyInput(gross);
  }
}

function getGrossSalary() {
  if (!selectedPayrollWorker) return 0;
  const salaryType = String(selectedPayrollWorker["薪水类型"] || "");
  if (salaryType === "日薪") {
    return parsePayrollMoney(selectedPayrollWorker["日薪"]) * getSelectedMonthDays();
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
  return payrollRecords.find(item =>
    String(item["工人编号"]) === String(selectedPayrollWorker["工人编号"]) &&
    normalizePayrollMonth(item["月份"]) === monthKey
  ) || null;
}

function normalizeDebtType(type) {
  return type === "医疗" ? "其他" : type;
}

function getOutstandingByType(workerNo) {
  const totals = Object.fromEntries(DEBT_TYPES.map(type => [type, 0]));
  const currentMonth = normalizePayrollMonth(getSelectedPayrollMonthKey());

  payrollAdvances.forEach(item => {
    if (String(item["工人编号"]) !== String(workerNo)) return;
    const type = normalizeDebtType(item["项目"] || item["类型"]);
    if (type in totals) totals[type] += parsePayrollMoney(item["金额"]);
  });

  payrollRecords.forEach(item => {
    if (String(item["工人编号"]) !== String(workerNo)) return;
    if (normalizePayrollMonth(item["月份"]) === currentMonth) return;

    totals["支粮"] -= parsePayrollMoney(item["支粮扣款"]);
    totals["准证"] -= parsePayrollMoney(item["准证扣款"]);
    totals["其他"] -= parsePayrollMoney(item["欠款其他扣款"]);
    totals["其他"] -= parsePayrollMoney(item["医疗扣款"]);
  });

  DEBT_TYPES.forEach(type => totals[type] = Math.max(0, totals[type]));
  return totals;
}

function renderDebtList() {
  const list = document.getElementById("debtList");
  if (!selectedPayrollWorker) return;

  const balances = getOutstandingByType(selectedPayrollWorker["工人编号"]);
  const current = getCurrentMonthPayrollRecord();
  const saved = {
    "支粮": parsePayrollMoney(current && current["支粮扣款"]),
    "准证": parsePayrollMoney(current && current["准证扣款"]),
    "其他": parsePayrollMoney(current && current["欠款其他扣款"])
  };

  list.innerHTML = DEBT_TYPES.map(type => {
    const balance = balances[type] || 0;
    const value = Math.min(saved[type] || 0, balance);
    return `
      <div class="debt-row">
        <div class="debt-info">
          <div class="debt-type">${type}</div>
          <div class="debt-balance">余额 ${formatPayrollCurrency(balance)}</div>
          <div class="debt-remaining" data-remaining-type="${type}">扣后剩余 ${formatPayrollCurrency(balance - value)}</div>
        </div>
        <input class="debt-deduction-input money-right" data-type="${type}" data-balance="${balance}"
          type="text" inputmode="decimal" placeholder="0.00" value="${value > 0 ? moneyInput(value) : ""}"
          ${balance <= 0 ? "readonly" : ""} />
      </div>
    `;
  }).join("");

  if (current) {
    const action = String(current["缺席处理"] || "扣薪");
    const radio = document.querySelector(`input[name="absenceAction"][value="${action}"]`);
    if (radio) radio.checked = true;

    const allowanceInput = getAllowanceInput();
if (allowanceInput) {
  const savedAllowance = parsePayrollMoney(current["津贴"]);
  allowanceInput.value = savedAllowance > 0 ? moneyInput(savedAllowance) : "";
}
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

function calculatePayroll() {
  const form = document.getElementById("payrollForm");
  const grossSalary = getGrossSalary();
  const allowance = getAllowanceAmount();
  const absence = getAbsenceSummary();
  const absenceAction = form.querySelector('input[name="absenceAction"]:checked')?.value || "扣薪";
  const absenceDeduction = absenceAction === "扣薪" ? absence.expectedAmount : 0;

  let debtDeduction = 0;
  let totalOutstanding = 0;
  let invalidDeduction = false;

  document.querySelectorAll(".debt-deduction-input").forEach(input => {
    const balance = Number(input.dataset.balance) || 0;
    const deduction = parsePayrollMoney(input.value);
    const remaining = Math.max(0, balance - deduction);

    totalOutstanding += balance;
    debtDeduction += deduction;
    input.classList.toggle("input-error", deduction > balance);
    if (deduction > balance) invalidDeduction = true;

    const remainingBox = document.querySelector(`[data-remaining-type="${input.dataset.type}"]`);
    if (remainingBox) remainingBox.textContent = `扣后剩余 ${formatPayrollCurrency(remaining)}`;
  });

  document.getElementById("absenceAmountText").textContent = formatPayrollCurrency(absenceDeduction);

  const totalDeduction = absenceDeduction + debtDeduction;
  const netSalary = Math.max(0, grossSalary + allowance - totalDeduction);
  const remainingDebt = Math.max(0, totalOutstanding - debtDeduction);

  document.getElementById("totalDeductionText").textContent = formatPayrollCurrency(totalDeduction);
  document.getElementById("netSalaryText").textContent = formatPayrollCurrency(netSalary);
  document.getElementById("remainingDebtText").textContent = formatPayrollCurrency(remainingDebt);

  return { grossSalary, allowance, absence, absenceAction, absenceDeduction, debtDeduction, totalDeduction, netSalary, remainingDebt, invalidDeduction };
}

async function handlePayrollSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const btn = document.getElementById("savePayrollBtn");

  if (!selectedPayrollWorker) {
    showStatus("status", "请选择工人", false);
    return;
  }

  try {
    const calculation = calculatePayroll();
    if (calculation.grossSalary <= 0) throw new Error("本月工资必须大于 0");
    if (calculation.invalidDeduction) throw new Error("本月扣除不能超过欠款余额");
    if (calculation.totalDeduction > calculation.grossSalary + calculation.allowance) {
      throw new Error("总扣款不能超过本月工资加津贴");
    }

    const deductions = Object.fromEntries(DEBT_TYPES.map(type => [type, 0]));
    document.querySelectorAll(".debt-deduction-input").forEach(input => {
      deductions[input.dataset.type] = parsePayrollMoney(input.value);
    });

    const salaryType = String(selectedPayrollWorker["薪水类型"] || "");
    const payroll = {
      payDate: formatDateDDMMYYYY(new Date()),
      month: getSelectedPayrollMonthKey(),
      company: form.company.value,
      workerNo: selectedPayrollWorker["工人编号"],
      workerName: selectedPayrollWorker["工人名字"],
      salaryType,
      workDays: 0,
      salaryRate: parsePayrollMoney(selectedPayrollWorker["日薪"]),
      monthlySalary: parsePayrollMoney(selectedPayrollWorker["月薪"]),
      basicSalary: calculation.grossSalary,
      allowance: calculation.allowance,
      absenceDays: calculation.absence.days,
      absenceAction: calculation.absenceAction,
      absenceExpectedAmount: calculation.absence.expectedAmount,
      absenceDeduction: calculation.absenceDeduction,
      advanceDeduction: deductions["支粮"] || 0,
      permitDeduction: deductions["准证"] || 0,
      medicalDeduction: 0,
      debtOtherDeduction: deductions["其他"] || 0,
      otherPayrollDeduction: 0,
      totalDeduction: calculation.totalDeduction,
      netSalary: calculation.netSalary,
      debtBalance: calculation.remainingDebt,
      remark: form.remark.value.trim()
    };

    btn.disabled = true;
    btn.textContent = "保存中...";

    const result = await api("savePayroll", { payroll });
    showStatus("status", result && result.updated ? "Payroll 已更新" : "Payroll 已保存", true);

    const savedRecord = result && result.record ? result.record : {
      "发薪日期": payroll.payDate,
      "月份": payroll.month,
      "公司": payroll.company,
      "工人编号": payroll.workerNo,
      "工人名字": payroll.workerName,
      "薪水类型": payroll.salaryType,
      "日薪": payroll.salaryRate,
      "月薪": payroll.monthlySalary,
      "基本薪水": payroll.basicSalary,
      "津贴": payroll.allowance,
      "缺席天数": payroll.absenceDays,
      "缺席处理": payroll.absenceAction,
      "缺席应扣金额": payroll.absenceExpectedAmount,
      "缺席扣款": payroll.absenceDeduction,
      "支粮扣款": payroll.advanceDeduction,
      "准证扣款": payroll.permitDeduction,
      "医疗扣款": payroll.medicalDeduction,
      "欠款其他扣款": payroll.debtOtherDeduction,
      "其他工资扣款": payroll.otherPayrollDeduction,
      "总扣款": payroll.totalDeduction,
      "实发薪水": payroll.netSalary,
      "欠款余额": payroll.debtBalance,
      "备注": payroll.remark
    };

    const keyMonth = normalizePayrollMonth(savedRecord["月份"]);
    const keyWorker = String(savedRecord["工人编号"] || "");
    const index = payrollRecords.findIndex(item =>
      normalizePayrollMonth(item["月份"]) === keyMonth &&
      String(item["工人编号"] || "") === keyWorker
    );

    if (index >= 0) payrollRecords[index] = savedRecord;
    else payrollRecords.push(savedRecord);

    renderPayrollHistory();
    renderDebtList();
    form.remark.value = "";
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

 const totalNetSalary = payrollRecords
  .filter(item =>
    normalizePayrollMonth(item["月份"]) === selectedMonth
  )
  .reduce(
    (sum, item) => sum + parsePayrollMoney(item["实发薪水"]),
    0
  );
  const recordsHtml = sorted.map(item => {
    const absenceDays = Number(item["缺席天数"]) || 0;
    const allowance = parsePayrollMoney(item["津贴"]);
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
        ${summaryParts.length ? `<div class="muted payroll-record-summary">${summaryParts.join(" · ")}</div>` : ""}
        <div class="payroll-net-line">实发 : ${formatPayrollCurrency(item["实发薪水"])}</div>
        <div class="payroll-debt-balance-line">欠款余额 : ${formatPayrollCurrency(debtBalance)}</div>
      </div>
    `;
  }).join("");

  const totalHtml = `
    <div class="payroll-total-card">
     <div class="payroll-total-title">
  ${escapePayrollHtml(selectedMonth)} · 两间公司本月实发工资总数
</div>
      <div class="payroll-total-amount">${formatPayrollCurrency(totalNetSalary)}</div>
    </div>
  `;

  list.innerHTML = recordsHtml + totalHtml;
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

const PAYROLL_DEFAULT_PERIOD_KEY = "ll-workforce-payroll-default-period-v420";
const PAYSLIP_IS_MOBILE_ = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

function isPayslipMobileViewOnly() {
  return PAYSLIP_IS_MOBILE_;
}

function applyPayslipMobileViewOnlyMode() {
  if (!isPayslipMobileViewOnly()) return;

  document.documentElement.classList.add("payslip-mobile-view-only");

  const notice = document.getElementById("payslipMobileNotice");
  const printBtn = document.getElementById("printPayslipBtn");

  if (notice) notice.hidden = false;
  if (printBtn) {
    printBtn.hidden = true;
    printBtn.disabled = true;
    printBtn.setAttribute("aria-disabled", "true");
  }
}

let payslipPrintContext = null;
let payslipPrintRequested = false;

document.addEventListener("DOMContentLoaded", () => {
  setupBackToPayrollButton();
  applyPayslipMobileViewOnlyMode();
  loadPayslipPage();
});

function setupBackToPayrollButton() {
  const backBtn = document.getElementById("backPayrollBtn");
  if (!backBtn) return;

  backBtn.addEventListener("click", event => {
    event.preventDefault();

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = "payroll.html";
  });
}

async function loadPayslipPage() {
  const status = document.getElementById("payslipStatus");
  const paper = document.getElementById("payslipPaper");
  const printBtn = document.getElementById("printPayslipBtn");

  status.textContent = "正在载入工资单… / Loading payslip…";
  status.className = "status no-print";
  paper.hidden = true;
  printBtn.hidden = true;

  try {
    const params = new URLSearchParams(window.location.search);
    const company = params.get("company") || "";
    const workerNo = params.get("workerNo") || "";
    const month = normalizePayslipMonth(params.get("month") || "");

    if (!company || !workerNo || !month) {
      throw new Error("工资单资料不完整。 / Payslip information is incomplete.");
    }

    const [payrolls, advances] = await loadPayslipDataWithRetry();
    const record = payrolls.find(item =>
      String(item["公司"] || "") === company &&
      String(item["工人编号"] || "") === workerNo &&
      normalizePayslipMonth(item["月份"]) === month
    );

    if (!record) {
      throw new Error("找不到 Payroll 记录。 / Payroll record was not found.");
    }

    await ensurePayslipMalayRemarks(record);
    renderPayslipCopies(record, advances);
    setPdfFileName(record);
    payslipPrintContext = { company, workerNo, month };
    status.textContent = isPayslipMobileViewOnly()
      ? "工资单已载入。手机只可查看，打印请到电脑处理。"
      : "工资单已准备，可以打印。 / Payslip is ready to print.";
    status.className = "status ok no-print";
    paper.hidden = false;

    if (isPayslipMobileViewOnly()) {
      applyPayslipMobileViewOnlyMode();
    } else {
      printBtn.hidden = false;
      printBtn.addEventListener("click", () => {
        payslipPrintRequested = true;
        window.print();
      });
    }
  } catch (error) {
    status.textContent = error?.message || "工资单载入失败，请稍后重试。 / Unable to load payslip.";
    status.className = "status err no-print";
  }
}

window.addEventListener("afterprint", async () => {
  if (isPayslipMobileViewOnly()) return;
  if (!payslipPrintRequested || !payslipPrintContext) return;
  payslipPrintRequested = false;

  const status = document.getElementById("payslipStatus");
  const currentMonth = normalizePayslipMonth(payslipPrintContext.month);

  try {
    if (status) {
      status.textContent = "正在记录打印状态… / Recording print status…";
      status.className = "status no-print";
    }

    await api("markPayrollPrinted", {
      key: {
        company: payslipPrintContext.company,
        workerNo: payslipPrintContext.workerNo,
        month: currentMonth
      }
    });

    const [workers, payrolls] = await Promise.all([
      api("getWorkers", {}, { forceRefresh: true }),
      api("getPayrolls", {}, { forceRefresh: true })
    ]);

    const activeWorkers = Array.isArray(workers) ? workers : [];
    const monthPayrolls = (Array.isArray(payrolls) ? payrolls : []).filter(item =>
      normalizePayslipMonth(item["月份"]) === currentMonth
    );

    const printedKeys = new Set(
      monthPayrolls
        .filter(item => String(item["已打印"] || "").trim() === "是")
        .map(item => [
          String(item["公司"] || "").trim(),
          String(item["工人编号"] || "").trim()
        ].join("__"))
    );

    const workerKey = worker => [
      String(worker["公司"] || "").trim(),
      String(worker["工人编号"] || "").trim()
    ].join("__");

    const printedCount = activeWorkers.filter(worker =>
      printedKeys.has(workerKey(worker))
    ).length;

    const allWorkersPrinted =
      activeWorkers.length > 0 &&
      activeWorkers.every(worker => printedKeys.has(workerKey(worker)));

    if (!allWorkersPrinted) {
      if (status) {
        status.textContent = `${currentMonth} 已记录打印（${printedCount}/${activeWorkers.length} 位在职工人）。全部打印后才会提示切换月份。`;
        status.className = "status ok no-print";
      }
      return;
    }

    const confirmKey = `ll-workforce-payroll-period-confirmed-v420-${currentMonth}`;
    if (localStorage.getItem(confirmKey) === "yes") {
      if (status) {
        status.textContent = `${currentMonth} 全部工资单已打印完成。`;
        status.className = "status ok no-print";
      }
      return;
    }

    const confirmed = window.confirm([
      `${currentMonth} 所有在职工人的工资单已经打印完成。`,
      "",
      "是否确认已经完成出粮，并把 Payroll 默认月份切换到下一个月？",
      "如果还要检查或重印，请选择取消。"
    ].join("\n"));

    if (!confirmed) {
      if (status) {
        status.textContent = `${currentMonth} 全部工资单已打印，但月份尚未切换。`;
        status.className = "status ok no-print";
      }
      return;
    }

    const next = getNextPayrollPeriod(currentMonth);
    if (!next) return;

    localStorage.setItem(confirmKey, "yes");
    localStorage.setItem(PAYROLL_DEFAULT_PERIOD_KEY, JSON.stringify(next));

    sessionStorage.setItem("payrollMonth", next.month);
    sessionStorage.setItem("payrollYear", next.year);
    sessionStorage.setItem("payrollCompany", String(payslipPrintContext.company || ""));
    sessionStorage.setItem("payrollWorker", "");

    if (status) {
      status.textContent = `${currentMonth} 已确认出粮。Payroll 默认月份已切换到 ${next.month}-${next.year}。`;
      status.className = "status ok no-print";
    }
  } catch (error) {
    if (status) {
      status.textContent = error?.message || "打印状态保存失败，请稍后重试。";
      status.className = "status err no-print";
    }
  }
});

function getNextPayrollPeriod(monthValue) {
  const month = normalizePayslipMonth(monthValue);
  const match = month.match(/^(\d{2})-(\d{4})$/);
  if (!match) return null;

  const date = new Date(Number(match[2]), Number(match[1]), 1);
  return {
    month: String(date.getMonth() + 1).padStart(2, "0"),
    year: String(date.getFullYear())
  };
}

async function loadPayslipDataWithRetry() {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const options = attempt === 0 ? {} : { forceRefresh: true };
      const [payrolls, advances] = await Promise.all([
        api("getPayrolls", {}, options),
        api("getAdvances", {}, options)
      ]);
      return [
        Array.isArray(payrolls) ? payrolls : [],
        Array.isArray(advances) ? advances : []
      ];
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
  throw lastError || new Error("工资单载入失败。 / Unable to load payslip.");
}

async function ensurePayslipMalayRemarks(item) {
  const allocations = parsePayslipDebtAllocations(item);
  const missing = [...new Set(allocations
    .filter(entry => !String(entry.malayRemark || "").trim())
    .map(entry => String(entry.remark || "").trim())
    .filter(Boolean))];

  if (!missing.length) return;

  const fallbackMap = {
    "买手机": "Membeli telefon bimbit",
    "回家乡": "Pulang ke kampung halaman"
  };

  let translated = [];
  try {
    translated = await api("translatePayrollRemarks", { remarks: missing });
  } catch (_) {
    translated = [];
  }

  const map = new Map();
  missing.forEach((text, index) => {
    const result = String(translated[index] || "").trim();
    map.set(text, result || fallbackMap[text] || text);
  });

  allocations.forEach(entry => {
    const source = String(entry.remark || "").trim();
    if (!String(entry.malayRemark || "").trim() && source) {
      entry.malayRemark = map.get(source) || source;
    }
  });

  item["扣款明细JSON"] = JSON.stringify(allocations);
}

function renderPayslipCopies(item, advances) {
  document.querySelectorAll(".payslip-copy-content").forEach(container => {
    container.innerHTML = createPayslipCopyHtml(item, advances);
  });
}

function parsePayslipDebtAllocations(item) {
  try {
    const parsed = JSON.parse(String(item["扣款明细JSON"] || "[]"));
    return Array.isArray(parsed) ? parsed.filter(entry => parsePayslipMoney(entry.deducted) > 0) : [];
  } catch (_) {
    return [];
  }
}

function createPayslipCopyHtml(item, advances) {
  const basicSalary = parsePayslipMoney(item["基本薪水"]);
  const allowance = parsePayslipMoney(item["津贴"]);
  const liveCommission = parsePayslipMoney(item["直播佣金"]);
  const totalDeduction = parsePayslipMoney(item["总扣款"]);
  const netSalary = parsePayslipMoney(item["实发薪水"]);
  const debtBalance = parsePayslipMoney(item["欠款余额"]);
  const month = normalizePayslipMonth(item["月份"]);
  const workerNo = String(item["工人编号"] || "");

  const advanceDeduction =
    parsePayslipMoney(item["支粮扣款"]) +
    parsePayslipMoney(item["欠款其他扣款"]) +
    parsePayslipMoney(item["医疗扣款"]) +
    parsePayslipMoney(item["其他工资扣款"]);

  const debtAllocations = parsePayslipDebtAllocations(item);

  const deductionItems = [];
  if (parsePayslipMoney(item["缺席扣款"]) > 0) {
    deductionItems.push({
      label: "Potongan Tidak Hadir / Absence Deduction",
      value: parsePayslipMoney(item["缺席扣款"]),
      note: ""
    });
  }

  if (debtAllocations.length) {
    debtAllocations.forEach(entry => {
      const date = formatPayslipDate(entry.date);
      const type = String(entry.type || "支粮");
      const label = type === "准证"
        ? "Potongan Permit / Permit Deduction"
        : "Potongan Pendahuluan / Advance Deduction";
      deductionItems.push({
        label: `${label} · ${date}`,
        value: parsePayslipMoney(entry.deducted),
        note: String(entry.remark || "").trim() ? String(entry.malayRemark || entry.remark || "").trim() : ""
      });
    });
  } else {
    if (advanceDeduction > 0) {
      deductionItems.push({
        label: "Potongan Pendahuluan / Advance Deduction",
        value: advanceDeduction,
        note: String(item["支粮马来文说明"] || item["支粮扣款说明"] || "").trim()
      });
    }
    if (parsePayslipMoney(item["准证扣款"]) > 0) {
      deductionItems.push({
        label: "Potongan Permit / Permit Deduction",
        value: parsePayslipMoney(item["准证扣款"]),
        note: ""
      });
    }
  }

  const deductionHtml = deductionItems.length
    ? deductionItems.map(entry => `
        <div>
          <span>${escapePayslipHtml(entry.label)}${entry.note ? `<small class="payslip-deduction-note">${escapePayslipHtml(entry.note)}</small>` : ""}</span>
          <strong>${formatPayslipCurrency(entry.value)}</strong>
        </div>
      `).join("")
    : '<div><span>Tiada Potongan / No Deduction</span><strong>RM 0.00</strong></div>';

  return `
    <header class="payslip-header">
      <div class="payslip-company">${escapePayslipHtml(item["公司"] || "LOVER LEGEND")}</div>
      <div class="payslip-title-row"><div class="payslip-title">SLIP GAJI / PAYSLIP</div><div class="payslip-month">Bulan / Month: ${escapePayslipHtml(month)}</div></div>
    </header>

    <div class="payslip-info-grid">
      <div><span>No. Pekerja / Employee No.</span><strong>${escapePayslipHtml(item["工人编号"] || "-")}</strong></div>
      <div><span>Nama Pekerja / Employee Name</span><strong>${escapePayslipHtml(item["工人名字"] || "-")}</strong></div>
      <div><span>Jenis Gaji / Salary Type</span><strong>${escapePayslipHtml(translateSalaryType(item["薪水类型"]))}</strong></div>
      <div><span>Tarikh Bayaran / Payment Date</span><strong>${escapePayslipHtml(getPayslipPaymentDate(month))}</strong></div>
    </div>

    <div class="payslip-section-title">Pendapatan / Income</div>
    <div class="payslip-lines">
      <div><span>Gaji Bulan Ini / Current Month Salary</span><strong>${formatPayslipCurrency(basicSalary)}</strong></div>
      ${allowance > 0 ? `<div><span>Elaun / Allowance</span><strong>${formatPayslipCurrency(allowance)}</strong></div>` : ""}
      ${liveCommission > 0 ? `<div><span>Komisen Jualan Live / Live Sales Commission</span><strong>${formatPayslipCurrency(liveCommission)}</strong></div>` : ""}
      <div class="payslip-total-line"><span>Jumlah Pendapatan / Total Income</span><strong>${formatPayslipCurrency(basicSalary + allowance + liveCommission)}</strong></div>
    </div>

    <div class="payslip-section-title">Potongan / Deduction</div>
    <div class="payslip-lines">${deductionHtml}</div>
    <div class="payslip-lines"><div class="payslip-total-line"><span>Jumlah Potongan / Total Deduction</span><strong>${formatPayslipCurrency(totalDeduction)}</strong></div></div>

    <div class="payslip-result-row">
      <div class="payslip-net-box"><span>Gaji Bersih / Net Salary</span><strong>${formatPayslipCurrency(netSalary)}</strong></div>
      <div class="payslip-debt-box"><span>Baki Hutang / Outstanding Balance</span><strong>${formatPayslipCurrency(debtBalance)}</strong></div>
    </div>
  `;
}

function payslipDebtDateNumber(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? Number(match[3] + match[2] + match[1]) : 0;
}

function setPdfFileName(item) {
  const workerName = sanitizeFileName(item["工人名字"] || item["工人编号"] || "Pekerja");
  const month = sanitizeFileName(normalizePayslipMonth(item["月份"]) || "");
  document.title = `Slip Gaji-${workerName}${month ? `-${month}` : ""}`;
}

function sanitizeFileName(value) {
  return String(value || "").trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
}

function translateSalaryType(value) {
  const type = String(value || "");
  if (type === "日薪") return "Gaji Harian / Daily Wage";
  if (type === "月薪") return "Gaji Bulanan / Monthly Salary";
  return type || "-";
}

function normalizePayslipMonth(value) {
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

function getPayslipPaymentDate(monthValue) {
  const month = normalizePayslipMonth(monthValue);
  const match = month.match(/^(\d{2})-(\d{4})$/);
  if (!match) return "-";

  // Payroll for a month is paid on the first day of the following month.
  // Example: 07-2026 -> 01-08-2026.
  const date = new Date(Number(match[2]), Number(match[1]), 1);
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function formatPayslipDate(value) {
  if (!value) return "-";
  const text = String(value).trim();
  if (/^\d{2}-\d{2}-\d{4}/.test(text)) return text.substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month, day] = text.substring(0, 10).split("-");
    return `${day}-${month}-${year}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function parsePayslipMoney(value) {
  return Number(String(value ?? "").replace(/[^\d.-]/g, "")) || 0;
}

function formatPayslipCurrency(value) {
  return "RM " + parsePayslipMoney(value).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapePayslipHtml(value) {
  return String(value ?? "").replace(/[&<>\"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;"
  }[char]));
}

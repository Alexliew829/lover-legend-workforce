document.addEventListener("DOMContentLoaded", loadPayslipPage);

async function loadPayslipPage() {
  const status = document.getElementById("payslipStatus");
  const paper = document.getElementById("payslipPaper");
  const printBtn = document.getElementById("printPayslipBtn");

  try {
    const params = new URLSearchParams(window.location.search);
    const workerNo = params.get("workerNo") || "";
    const month = normalizePayslipMonth(params.get("month") || "");

    if (!workerNo || !month) {
      throw new Error("工资单资料不完整。 / Payslip information is incomplete.");
    }

    const data = await api("getPayrollBootstrap");
    const payrolls = data?.payrolls || [];
    const advances = data?.advances || [];
    const record = payrolls.find(item =>
      String(item["工人编号"] || "") === workerNo &&
      normalizePayslipMonth(item["月份"]) === month
    );

    if (!record) {
      throw new Error("找不到 Payroll 记录。 / Payroll record was not found.");
    }

    renderPayslipCopies(record, advances);
    setPdfFileName(record);
    status.textContent = "工资单已准备，可以打印。 / Payslip is ready to print.";
    status.className = "status ok no-print";
    paper.hidden = false;
    printBtn.hidden = false;
    printBtn.addEventListener("click", () => window.print());
  } catch (error) {
    status.textContent = error.message;
    status.className = "status err no-print";
  }
}

function renderPayslipCopies(item, advances) {
  document.querySelectorAll(".payslip-copy-content").forEach(container => {
    container.innerHTML = createPayslipCopyHtml(item, advances);
  });
}

function createPayslipCopyHtml(item, advances) {
  const basicSalary = parsePayslipMoney(item["基本薪水"]);
  const allowance = parsePayslipMoney(item["津贴"]);
  const totalDeduction = parsePayslipMoney(item["总扣款"]);
  const netSalary = parsePayslipMoney(item["实发薪水"]);
  const debtBalance = parsePayslipMoney(item["欠款余额"]);
  const month = normalizePayslipMonth(item["月份"]);

  const deductionItems = [
    ["Potongan Tidak Hadir / Absence Deduction", item["缺席扣款"]],
    [
      "Potongan Pendahuluan / Advance Deduction",
      item["支粮扣款"],
      getPayslipDeductionNote(item, advances, "支粮", item["支粮扣款说明"])
    ],
    [
      "Potongan Permit / Permit Deduction",
      item["准证扣款"],
      getPayslipDeductionNote(item, advances, "准证", item["准证扣款说明"])
    ],
    ["Potongan Perubatan / Medical Deduction", item["医疗扣款"]],
    [
      "Potongan Hutang Lain-lain / Other Debt Deduction",
      item["欠款其他扣款"],
      getPayslipDeductionNote(item, advances, "其他", item["其他扣款说明"])
    ],
    ["Potongan Gaji Lain-lain / Other Payroll Deduction", item["其他工资扣款"]]
  ].filter(([, value]) => parsePayslipMoney(value) > 0);

  const deductionHtml = deductionItems.length
    ? deductionItems.map(([label, value, note]) => `
        <div><span>${escapePayslipHtml(label)}${note ? `<small class="payslip-deduction-note">${escapePayslipHtml(note)}</small>` : ""}</span><strong>${formatPayslipCurrency(value)}</strong></div>
      `).join("")
    : '<div><span>Tiada Potongan / No Deduction</span><strong>RM 0.00</strong></div>';

  return `
    <header class="payslip-header">
      <div class="payslip-company">${escapePayslipHtml(item["公司"] || "LOVER LEGEND")}</div>
      <div class="payslip-title">SLIP GAJI / PAYSLIP</div>
      <div class="payslip-month">Bulan / Month: ${escapePayslipHtml(month)}</div>
    </header>

    <div class="payslip-info-grid">
      <div><span>No. Pekerja / Employee No.</span><strong>${escapePayslipHtml(item["工人编号"] || "-")}</strong></div>
      <div><span>Nama Pekerja / Employee Name</span><strong>${escapePayslipHtml(item["工人名字"] || "-")}</strong></div>
      <div><span>Syarikat / Company</span><strong>${escapePayslipHtml(item["公司"] || "-")}</strong></div>
      <div><span>Jenis Gaji / Salary Type</span><strong>${escapePayslipHtml(translateSalaryType(item["薪水类型"]))}</strong></div>
      <div><span>Tarikh Bayaran / Payment Date</span><strong>${escapePayslipHtml(formatPayslipDate(item["发薪日期"]))}</strong></div>
    </div>

    <div class="payslip-section-title">Pendapatan / Income</div>
    <div class="payslip-lines">
      <div><span>Gaji Bulan Ini / Current Month Salary</span><strong>${formatPayslipCurrency(basicSalary)}</strong></div>
      ${allowance > 0 ? `<div><span>Elaun / Allowance</span><strong>${formatPayslipCurrency(allowance)}</strong></div>` : ""}
      <div class="payslip-total-line"><span>Jumlah Pendapatan / Total Income</span><strong>${formatPayslipCurrency(basicSalary + allowance)}</strong></div>
    </div>

    <div class="payslip-section-title">Potongan / Deduction</div>
    <div class="payslip-lines">${deductionHtml}</div>
    <div class="payslip-lines">
      <div class="payslip-total-line"><span>Jumlah Potongan / Total Deduction</span><strong>${formatPayslipCurrency(totalDeduction)}</strong></div>
    </div>

    <div class="payslip-result-row">
      <div class="payslip-net-box"><span>Gaji Bersih / Net Salary</span><strong>${formatPayslipCurrency(netSalary)}</strong></div>
      <div class="payslip-debt-box"><span>Baki Hutang / Outstanding Balance</span><strong>${formatPayslipCurrency(debtBalance)}</strong></div>
    </div>

    <div class="payslip-signatures">
      <div><div class="signature-line"></div><span>Tandatangan Pekerja / Employee Signature</span></div>
      <div><div class="signature-line"></div><span>Tandatangan Majikan / Employer Signature</span></div>
    </div>
  `;
}


function getPayslipDeductionNote(payroll, advances, type, savedNote) {
  // Payslip 的扣款备注以 Payroll 页面保存的“备注”为最新版本，确保修改后同步更新。
  const payrollRemark = String(payroll["备注"] || "").trim();
  if (payrollRemark) return payrollRemark;

  const direct = String(savedNote || "").trim();
  if (direct) return direct;

  const workerNo = String(payroll["工人编号"] || "");
  const normalizedType = type === "医疗" ? "其他" : type;

  const notes = (advances || [])
    .filter(item => {
      const itemType = String(item["项目"] || item["类型"] || "");
      const normalizedItemType = itemType === "医疗" ? "其他" : itemType;
      return String(item["工人编号"] || "") === workerNo &&
        normalizedItemType === normalizedType &&
        parsePayslipMoney(item["金额"]) > 0;
    })
    .map(item => String(item["备注"] || "").trim())
    .filter(Boolean);

  return [...new Set(notes)].join(" / ");
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

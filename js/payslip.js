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
      throw new Error("Maklumat slip gaji tidak lengkap.");
    }

    const data = await api("getPayrollBootstrap");
    const payrolls = data?.payrolls || [];
    const record = payrolls.find(item =>
      String(item["工人编号"] || "") === workerNo &&
      normalizePayslipMonth(item["月份"]) === month
    );

    if (!record) {
      throw new Error("Rekod payroll tidak dijumpai.");
    }

    renderPayslip(record);
    status.textContent = "Slip gaji sedia untuk dicetak.";
    status.className = "status ok no-print";
    paper.hidden = false;
    printBtn.hidden = false;
    printBtn.addEventListener("click", () => window.print());
  } catch (error) {
    status.textContent = error.message;
    status.className = "status err no-print";
  }
}

function renderPayslip(item) {
  const basicSalary = parsePayslipMoney(item["基本薪水"]);
  const allowance = parsePayslipMoney(item["津贴"]);
  const totalDeduction = parsePayslipMoney(item["总扣款"]);
  const netSalary = parsePayslipMoney(item["实发薪水"]);
  const debtBalance = parsePayslipMoney(item["欠款余额"]);

  setPayslipText("payslipCompany", item["公司"] || "LOVER LEGEND");
  setPayslipText("payslipMonth", `Bulan: ${normalizePayslipMonth(item["月份"])}`);
  setPayslipText("workerNo", item["工人编号"] || "-");
  setPayslipText("workerName", item["工人名字"] || "-");
  setPayslipText("companyName", item["公司"] || "-");
  setPayslipText("salaryType", translateSalaryType(item["薪水类型"]));
  setPayslipText("payDate", formatPayslipDate(item["发薪日期"]));
  setPayslipText("basicSalary", formatPayslipCurrency(basicSalary));
  setPayslipText("allowance", formatPayslipCurrency(allowance));
  setPayslipText("grossIncome", formatPayslipCurrency(basicSalary + allowance));
  setPayslipText("totalDeduction", formatPayslipCurrency(totalDeduction));
  setPayslipText("netSalary", formatPayslipCurrency(netSalary));
  setPayslipText("debtBalance", formatPayslipCurrency(debtBalance));

  document.getElementById("allowanceRow").style.display = allowance > 0 ? "flex" : "none";

  const deductionItems = [
    ["Potongan Tidak Hadir", item["缺席扣款"]],
    ["Potongan Pendahuluan", item["支粮扣款"]],
    ["Potongan Permit", item["准证扣款"]],
    ["Potongan Perubatan", item["医疗扣款"]],
    ["Potongan Hutang Lain-lain", item["欠款其他扣款"]],
    ["Potongan Gaji Lain-lain", item["其他工资扣款"]]
  ].filter(([, value]) => parsePayslipMoney(value) > 0);

  const deductionLines = document.getElementById("deductionLines");
  deductionLines.innerHTML = deductionItems.length
    ? deductionItems.map(([label, value]) => `
        <div><span>${escapePayslipHtml(label)}</span><strong>${formatPayslipCurrency(value)}</strong></div>
      `).join("")
    : '<div><span>Tiada Potongan</span><strong>RM 0.00</strong></div>';
}

function setPayslipText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function translateSalaryType(value) {
  const type = String(value || "");
  if (type === "日薪") return "Gaji Harian";
  if (type === "月薪") return "Gaji Bulanan";
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
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '\"': "&quot;"
  }[char]));
}

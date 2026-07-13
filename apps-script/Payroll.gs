/*************************************************
 * Lover Legend Workforce ERP
 * Payroll.gs — V1.7
 *************************************************/

const PAYROLL_HEADERS_V162_ = [
  "发薪日期", "月份", "公司", "工人编号", "工人名字", "薪水类型", "工作天数",
  "日薪", "月薪", "基本薪水", "缺席天数", "缺席处理", "缺席应扣金额",
  "缺席扣款", "支粮扣款", "准证扣款", "医疗扣款", "欠款其他扣款",
  "其他工资扣款", "总扣款", "实发薪水", "备注"
];

function getPayrolls() {
  const cached = cacheRead_(WORKFORCE_CACHE_KEYS_.PAYROLLS);
  if (cached) return cached;

  const sh = ensurePayrollSheet_();

  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  const payrolls = values.slice(1).map((row, index) => {
    const obj = {};
    headers.forEach((header, i) => {
      if (header === "发薪日期") {
        obj[header] = normalizePayrollDateText_(row[i]);
      } else if (header === "月份") {
        obj[header] = normalizePayrollMonthText_(row[i]);
      } else {
        obj[header] = row[i];
      }
    });
    obj.row = index + 2;
    return obj;
  }).filter(row => row["工人编号"] && row["工人名字"]);

  return cacheWrite_(WORKFORCE_CACHE_KEYS_.PAYROLLS, payrolls);
}

function savePayroll(payroll) {
  validatePayroll_(payroll);

  const sh = ensurePayrollSheet_();
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const rowData = buildPayrollRow_(headers, payroll);

  let targetRow = 0;
  let wasUpdated = false;
  for (let i = 1; i < values.length; i++) {
    const rowObj = {};
    headers.forEach((header, column) => rowObj[header] = values[i][column]);

    if (
      normalizePayrollMonthText_(rowObj["月份"]) === normalizePayrollMonthText_(payroll.month) &&
      String(rowObj["工人编号"] || "").trim() === String(payroll.workerNo || "").trim()
    ) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow) {
    wasUpdated = true;
    sh.getRange(targetRow, 1, 1, headers.length).setValues([rowData]);
    auditLog("更新 Payroll", payroll.month + " - " + payroll.workerNo + " - " + payroll.workerName);
  } else {
    sh.appendRow(rowData);
    targetRow = sh.getLastRow();
    auditLog("保存 Payroll", payroll.month + " - " + payroll.workerNo + " - " + payroll.workerName);
  }

  cleanupPayrollDuplicates_(sh);
  sortPayrollSheet_(sh);
  cacheRemove_([WORKFORCE_CACHE_KEYS_.PAYROLLS]);

  const savedRecord = {};
  headers.forEach((header, index) => savedRecord[header] = rowData[index]);
  savedRecord.row = targetRow;

  return { success: true, updated: wasUpdated, row: targetRow, record: savedRecord };
}

function validatePayroll_(payroll) {
  if (!payroll.month) throw new Error("请选择月份");
  if (!payroll.company) throw new Error("请选择公司");
  if (!payroll.workerNo || !payroll.workerName) throw new Error("请选择工人");
  if (Number(payroll.basicSalary) <= 0) throw new Error("本月工资必须大于 0");
  if (!["扣薪", "免扣"].includes(String(payroll.absenceAction || "扣薪"))) {
    throw new Error("缺席处理无效");
  }
  if (Number(payroll.totalDeduction) > Number(payroll.basicSalary)) {
    throw new Error("总扣款不能超过本月工资");
  }
}

function buildPayrollRow_(headers, payroll) {
  const map = {
    "发薪日期": payroll.payDate || formatDateDDMMYYYYPayroll_(new Date()),
    "月份": normalizePayrollMonthText_(payroll.month),
    "公司": payroll.company,
    "工人编号": payroll.workerNo,
    "工人名字": payroll.workerName,
    "薪水类型": payroll.salaryType,
    "工作天数": Number(payroll.workDays) || 0,
    "日薪": Number(payroll.salaryRate) || 0,
    "月薪": Number(payroll.monthlySalary) || 0,
    "基本薪水": Number(payroll.basicSalary) || 0,
    "缺席天数": Number(payroll.absenceDays) || 0,
    "缺席处理": payroll.absenceAction || "扣薪",
    "缺席应扣金额": Number(payroll.absenceExpectedAmount) || 0,
    "缺席扣款": Number(payroll.absenceDeduction) || 0,
    "支粮扣款": Number(payroll.advanceDeduction) || 0,
    "准证扣款": Number(payroll.permitDeduction) || 0,
    "医疗扣款": Number(payroll.medicalDeduction) || 0,
    "欠款其他扣款": Number(payroll.debtOtherDeduction) || 0,
    "其他工资扣款": Number(payroll.otherPayrollDeduction) || 0,
    "总扣款": Number(payroll.totalDeduction) || 0,
    "实发薪水": Number(payroll.netSalary) || 0,
    "备注": payroll.remark || ""
  };

  return headers.map(header => Object.prototype.hasOwnProperty.call(map, header) ? map[header] : "");
}

function ensurePayrollSheet_() {
  const ss = db();
  let sh = ss.getSheetByName(SHEETS.PAYROLL);
  if (!sh) sh = ss.insertSheet(SHEETS.PAYROLL);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, PAYROLL_HEADERS_V162_.length).setValues([PAYROLL_HEADERS_V162_]);
  } else {
    let existingHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const missingHeaders = PAYROLL_HEADERS_V162_.filter(header => !existingHeaders.includes(header));
    if (missingHeaders.length) {
      sh.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
      existingHeaders = existingHeaders.concat(missingHeaders);
    }
  }

  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight("bold").setBackground("#d9ead3");
  sh.setFrozenRows(1);
  return sh;
}

function cleanupPayrollDuplicates_(sh) {
  const values = sh.getDataRange().getValues();
  if (values.length <= 2) return;

  const headers = values[0];
  const monthCol = headers.indexOf("月份");
  const workerCol = headers.indexOf("工人编号");
  const nameCol = headers.indexOf("工人名字");
  if (monthCol < 0 || workerCol < 0) return;

  const latestRowByKey = {};
  for (let i = 1; i < values.length; i++) {
    const workerNo = String(values[i][workerCol] || "").trim();
    const workerName = nameCol >= 0 ? String(values[i][nameCol] || "").trim() : "";
    const month = normalizePayrollMonthText_(values[i][monthCol]);
    if (!workerNo || !month || !workerName) continue;
    latestRowByKey[workerNo + "__" + month] = i + 1;
  }

  const rowsToDelete = [];
  for (let i = 1; i < values.length; i++) {
    const workerNo = String(values[i][workerCol] || "").trim();
    const workerName = nameCol >= 0 ? String(values[i][nameCol] || "").trim() : "";
    const month = normalizePayrollMonthText_(values[i][monthCol]);
    if (!workerNo || !month || !workerName) continue;
    const key = workerNo + "__" + month;
    if (latestRowByKey[key] !== i + 1) rowsToDelete.push(i + 1);
  }

  rowsToDelete.sort((a, b) => b - a).forEach(row => sh.deleteRow(row));
}

function sortPayrollSheet_(sh) {
  const lastRow = sh.getLastRow();
  const lastColumn = sh.getLastColumn();
  if (lastRow <= 2) return;

  const headers = sh.getRange(1, 1, 1, lastColumn).getValues()[0];
  const companyCol = headers.indexOf("公司") + 1;
  const workerCol = headers.indexOf("工人编号") + 1;
  const monthCol = headers.indexOf("月份") + 1;
  if (!companyCol || !workerCol || !monthCol) return;

  sh.getRange(2, 1, lastRow - 1, lastColumn).sort([
    { column: companyCol, ascending: true },
    { column: workerCol, ascending: true },
    { column: monthCol, ascending: true }
  ]);
}

function normalizePayrollMonthText_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "MM-yyyy");
  }

  const text = String(value).trim();
  let match = text.match(/^(\d{2})-(\d{4})$/);
  if (match) return match[1] + "-" + match[2];

  match = text.match(/^(\d{4})-(\d{2})/);
  if (match) return match[2] + "-" + match[1];

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "MM-yyyy");
  }
  return text;
}

function normalizePayrollDateText_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd-MM-yyyy");
  }

  const text = String(value).trim();
  if (/^\d{2}-\d{2}-\d{4}/.test(text)) return text.substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const parts = text.substring(0, 10).split("-");
    return parts[2] + "-" + parts[1] + "-" + parts[0];
  }
  return text;
}

function formatDateDDMMYYYYPayroll_(value) {
  return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd-MM-yyyy");
}

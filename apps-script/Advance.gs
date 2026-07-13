/*************************************************
 * Lover Legend Workforce ERP
 * Advance.gs — V1.7
 *************************************************/

function getAdvances() {
  const cached = cacheRead_(WORKFORCE_CACHE_KEYS_.ADVANCES);
  if (cached) return cached;

  const sh = db().getSheetByName(SHEETS.ADVANCE);
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  const advances = values.slice(1).map((row, index) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = h === "日期时间" ? normalizeDateText_(row[i]) : row[i];
    });
    obj.row = index + 2;
    return obj;
  }).filter(r => r["工人名字"]);

  return cacheWrite_(WORKFORCE_CACHE_KEYS_.ADVANCES, advances);
}

function getAdvanceLedger() {
  const ledger = getAdvances().map(item => ({
    ...item,
    "交易来源": "新增",
    "显示金额": Number(item["金额"]) || 0
  }));

  const payrolls = typeof getPayrolls === "function" ? getPayrolls() : [];
  payrolls.forEach(payroll => {
    const date = payroll["发薪日期"] || payrollMonthEndDate_(payroll["月份"]);
    [
      ["支粮", payroll["支粮扣款"]],
      ["准证", payroll["准证扣款"]],
      ["其他", Number(payroll["欠款其他扣款"] || 0) + Number(payroll["医疗扣款"] || 0)]
    ].forEach(([type, amount]) => {
      const value = Number(amount) || 0;
      if (value <= 0) return;
      ledger.push({
        "日期时间": date,
        "公司": payroll["公司"],
        "工人编号": payroll["工人编号"],
        "工人名字": payroll["工人名字"],
        "项目": type,
        "金额": -value,
        "显示金额": -value,
        "备注": "Payroll " + payroll["月份"] + " 扣回",
        "交易来源": "Payroll"
      });
    });
  });

  return ledger;
}

function addAdvance(item) {
  validateAdvanceItem_(item);

  const amount = Number(item.amount);
  const sh = db().getSheetByName(SHEETS.ADVANCE);
  const values = sh.getDataRange().getValues();
  const duplicate = findDuplicateAdvance_(values, item);

  if (duplicate) {
    return {
      success: false,
      duplicate: true,
      row: duplicate.row,
      oldAmount: duplicate.amount,
      message: "这位工人当天已有相同项目记录"
    };
  }

  const nextRow = sh.getLastRow() + 1;
  const newDate = String(item.deductDate).trim();
  sh.getRange(nextRow, 1).setNumberFormat("@");
  sh.getRange(nextRow, 1, 1, 7).setValues([[
    newDate,
    item.company,
    item.workerNo,
    item.workerName,
    item.type,
    amount,
    item.remark || ""
  ]]);

  sortAdvanceSheet_(sh);
  cacheRemove_(WORKFORCE_CACHE_KEYS_.ADVANCES);
  auditLog("新增扣款", item.workerNo + " - " + item.workerName + " - " + item.type + " RM" + amount);

  return { success: true, duplicate: false, ledger: getAdvanceLedger() };
}

function updateAdvance(item) {
  validateAdvanceItem_(item);
  if (!item.row) throw new Error("找不到要修改的记录");

  const amount = Number(item.amount);
  const sh = db().getSheetByName(SHEETS.ADVANCE);
  const row = Number(item.row);

  sh.getRange(row, 1).setNumberFormat("@");
  sh.getRange(row, 1, 1, 7).setValues([[
    String(item.deductDate).trim(),
    item.company,
    item.workerNo,
    item.workerName,
    item.type,
    amount,
    item.remark || ""
  ]]);

  sortAdvanceSheet_(sh);
  cacheRemove_(WORKFORCE_CACHE_KEYS_.ADVANCES);
  auditLog("修改扣款", item.workerNo + " - " + item.workerName + " - " + item.type + " RM" + amount);

  return { success: true, ledger: getAdvanceLedger() };
}

function findDuplicateAdvance_(values, item) {
  const newDate = String(item.deductDate).trim();
  const newWorkerNo = String(item.workerNo).trim();
  const newType = String(item.type).trim();

  for (let i = 1; i < values.length; i++) {
    const rowDate = normalizeDateText_(values[i][0]);
    const rowWorkerNo = String(values[i][2] || "").trim();
    const rowType = String(values[i][4] || "").trim();

    if (rowDate === newDate && rowWorkerNo === newWorkerNo && rowType === newType) {
      return { row: i + 1, amount: Number(values[i][5]) || 0 };
    }
  }
  return null;
}

function validateAdvanceItem_(item) {
  if (!item.company) throw new Error("请选择公司");
  if (!item.workerNo) throw new Error("请选择工人");
  if (!item.workerName) throw new Error("请选择工人");
  if (!item.type) throw new Error("请选择项目");
  if (!item.deductDate) throw new Error("请选择日期");
  if (!item.amount) throw new Error("请输入金额");

  const amount = Number(item.amount);
  if (amount <= 0) throw new Error("金额必须大于 0");
}

function sortAdvanceSheet_(sh) {
  const lastRow = sh.getLastRow();
  const lastColumn = sh.getLastColumn();
  if (lastRow <= 2) return;

  sh.getRange(2, 1, lastRow - 1, lastColumn).sort([
    { column: 2, ascending: true },
    { column: 3, ascending: true },
    { column: 1, ascending: true }
  ]);
}

function payrollMonthEndDate_(monthValue) {
  const text = String(monthValue || "").trim();
  const match = text.match(/^(\d{2})-(\d{4})$/);
  if (!match) return text;
  const month = Number(match[1]);
  const year = Number(match[2]);
  const day = new Date(year, month, 0).getDate();
  return String(day).padStart(2, "0") + "-" + match[1] + "-" + match[2];
}

function normalizeDateText_(value) {
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

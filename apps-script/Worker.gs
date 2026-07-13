/*************************************************
 * Lover Legend Workforce ERP
 * Worker.gs
 *************************************************/

function getWorkers() {
  const cached = cacheRead_(WORKFORCE_CACHE_KEYS_.WORKERS);
  if (cached) return cached;

  const sh = db().getSheetByName(SHEETS.WORKERS);
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];

  const workers = values.slice(1).map((row, index) => {
    const obj = {};

    headers.forEach((h, i) => {
      if (h === "入职日期") {
        obj[h] = formatDateDDMMYYYY_(row[i]);
      } else {
        obj[h] = row[i];
      }
    });

    obj.row = index + 2;
    return obj;
  }).filter(r => r["工人名字"] && r["状态"] !== "离职")
    .sort((a, b) => String(a["工人编号"] || "").localeCompare(String(b["工人编号"] || ""), undefined, { numeric: true }));

  return cacheWrite_(WORKFORCE_CACHE_KEYS_.WORKERS, workers);
}

function addWorker(worker) {
  if (!worker.company) throw new Error("请选择公司");

  if (worker.workerNo) {
    throw new Error("新增工人不能自订工人编号");
  }

  if (!worker.name) throw new Error("请输入工人名字");
  if (worker.name.length > 20) throw new Error("工人名字不能超过20个字");
  if (!worker.salaryType) throw new Error("请选择薪水类型");

  const sh = db().getSheetByName(SHEETS.WORKERS);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const company = String(values[i][1]).trim();
    const name = String(values[i][2]).trim().toUpperCase();
    const status = String(values[i][9]).trim();

    if (
      company === worker.company.trim() &&
      name === worker.name.trim().toUpperCase() &&
      status !== "离职"
    ) {
      throw new Error("这个工人已经存在");
    }
  }

  const workerNo = generateWorkerNo_(values);

  sh.appendRow([
    workerNo,
    worker.company,
    worker.name,
    worker.phone || "",
    worker.ic || "",
    worker.salaryType,
    Number(worker.dailySalary) || "",
    Number(worker.monthlySalary) || "",
    worker.joinDate || "",
    "在职",
    worker.remark || ""
  ]);

  cacheRemove_(WORKFORCE_CACHE_KEYS_.WORKERS);
  auditLog("新增工人", workerNo + " - " + worker.name);
  return { success: true, workerNo: workerNo, workers: getWorkers() };
}

function updateWorkerByNo(worker) {
  if (!worker.workerNo) throw new Error("缺少工人编号");

  const sh = db().getSheetByName(SHEETS.WORKERS);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(worker.workerNo).trim()) {
      sh.getRange(i + 1, 2, 1, 10).setValues([[
        worker.company,
        worker.name,
        worker.phone || "",
        worker.ic || "",
        worker.salaryType,
        Number(worker.dailySalary) || "",
        Number(worker.monthlySalary) || "",
        worker.joinDate || "",
        worker.status || "在职",
        worker.remark || ""
      ]]);

      cacheRemove_(WORKFORCE_CACHE_KEYS_.WORKERS);
      auditLog("修改工人", worker.workerNo + " - " + worker.name);
      return { success: true, workers: getWorkers() };
    }
  }

  throw new Error("找不到工人：" + worker.workerNo);
}

function resignWorker(workerNo, workerName) {
  const sh = db().getSheetByName(SHEETS.WORKERS);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(workerNo).trim()) {
      sh.getRange(i + 1, 10).setValue("离职");
      cacheRemove_(WORKFORCE_CACHE_KEYS_.WORKERS);
      auditLog("办理离职", workerNo + " - " + workerName);
      return { success: true, workers: getWorkers() };
    }
  }

  throw new Error("找不到工人：" + workerNo);
}

function generateWorkerNo_(values) {
  let maxNo = 0;

  for (let i = 1; i < values.length; i++) {
    const no = String(values[i][0] || "").trim();

    if (/^W\d{4}$/.test(no)) {
      const num = Number(no.replace("W", ""));
      if (num > maxNo) maxNo = num;
    }
  }

  return "W" + String(maxNo + 1).padStart(4, "0");
}

function formatDateDDMMYYYY_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd-MM-yyyy");
  }

  return String(value);
}
let workersCache = [];
let advanceLedgerCache = [];
let editingAdvanceRow = null;
let payrollRepaymentLoading = false;
let payrollAbsenceStatusMap = new Map();
let advanceHistoryVisible = false;

const DEFAULT_ADVANCE_TYPE = "支粮";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("advanceForm");

  if (form) {
    setupDateDropdowns();
    setTodayDateDropdown(true);
    form.type.value = DEFAULT_ADVANCE_TYPE;

    form.company.addEventListener("change", handleCompanyChange);
    form.workerNo.addEventListener("change", handleWorkerChange);
    form.type.addEventListener("change", handleProjectChange);
    form.deductDay.addEventListener("change", handleAdvanceKeyChange);
    form.deductMonth.addEventListener("change", handleAdvanceKeyChange);
    form.deductYear.addEventListener("change", handleAdvanceKeyChange);
    form.amount.addEventListener("blur", () => {
      if (!form.amount.readOnly) formatInputMoney(form.amount);
    });
    form.addEventListener("submit", handleAdvanceSubmit);

    const historyButton = document.getElementById("toggleAdvanceHistoryBtn");
    if (historyButton) historyButton.addEventListener("click", toggleAdvanceHistory);
  }

  loadAdvancePage();
});

async function loadAdvancePage() {
  const cached = typeof getApiCachedData === "function"
    ? getApiCachedData("getAdvanceBootstrap", {})
    : null;

  if (cached) {
    applyAdvanceBootstrapData(cached);
    showStatus("status", "系统已就绪，正在后台同步最新欠款资料", true);
    loadPayrollRepaymentsInBackground();
  }

  try {
    const data = await api(
      "getAdvanceBootstrap",
      {},
      { forceRefresh: Boolean(cached) }
    );

    applyAdvanceBootstrapData(data);
    showStatus("status", "系统已就绪，可以记录欠款", true);

    // Payroll 扣回记录放到后台载入，不阻塞“系统已就绪”。
    loadPayrollRepaymentsInBackground();
  } catch (error) {
    if (cached) {
      showStatus("status", "暂时无法同步，正在使用上次载入的欠款资料", false);
      return;
    }

    showStatus("status", error.message, false);
  }
}

function applyPayrollAbsenceStatuses(statuses) {
  payrollAbsenceStatusMap = new Map();
  (Array.isArray(statuses) ? statuses : []).forEach(item => {
    const key = buildAbsencePayrollKey(
      item["公司"],
      item["工人编号"],
      item["月份"]
    );
    const status = String(item["状态"] || "").trim();
    if (key && (status === "已扣薪" || status === "免扣")) {
      payrollAbsenceStatusMap.set(key, status);
    }
  });
}

function applyAdvanceBootstrapData(data) {
  workersCache = Array.isArray(data?.workers) ? data.workers : [];
  advanceLedgerCache = (Array.isArray(data?.advances) ? data.advances : [])
    .map(item => ({
      ...item,
      "交易来源": "新增",
      "显示金额": Number(item["金额"]) || 0
    }));

  applyPayrollAbsenceStatuses(data?.payrollAbsenceStatuses);

  renderWorkerOptions();
  renderAdvanceLedger(advanceLedgerCache);
}

function updateAdvanceBrowserCache() {
  if (typeof setApiCachedData !== "function") return;

  const advances = advanceLedgerCache
    .filter(item => item["交易来源"] !== "Payroll")
    .map(item => {
      const record = { ...item };
      delete record["交易来源"];
      delete record["显示金额"];
      return record;
    });

  setApiCachedData("getAdvanceBootstrap", {}, {
    workers: workersCache,
    advances
  });
}

async function loadPayrollRepaymentsInBackground() {
  if (payrollRepaymentLoading) return;
  payrollRepaymentLoading = true;

  try {
    const payrolls = await api("getPayrolls");
    const repayments = [];
    const refreshedAbsenceStatusMap = new Map();

    (payrolls || []).forEach(payroll => {
      const payrollMonth = normalizeAdvanceMonthKey(payroll["月份"]);
      const payrollKey = buildAbsencePayrollKey(
        payroll["公司"],
        payroll["工人编号"],
        payrollMonth
      );
      const absenceAction = String(payroll["缺席处理"] || "").trim();
      const absenceDeduction = Number(payroll["缺席扣款"] || 0);

      refreshedAbsenceStatusMap.set(
        payrollKey,
        absenceAction === "免扣"
          ? "免扣"
          : (absenceAction === "扣薪" || absenceDeduction > 0 ? "已扣薪" : "免扣")
      );

      const date = payroll["发薪日期"] || payrollMonthEndDate(payroll["月份"]);
      let allocations = [];
      try {
        allocations = JSON.parse(String(payroll["扣款明细JSON"] || "[]"));
      } catch (_) {
        allocations = [];
      }

      if (Array.isArray(allocations) && allocations.length) {
        allocations.forEach(entry => {
          const value = Number(entry && entry.deducted) || 0;
          if (value <= 0) return;

          repayments.push({
            "日期时间": date,
            "公司": payroll["公司"],
            "工人编号": payroll["工人编号"],
            "工人名字": payroll["工人名字"],
            "项目": String(entry.type || "支粮"),
            "金额": -value,
            "显示金额": -value,
            "备注": `Payroll ${payrollMonth} 扣回${entry.remark ? ` · ${entry.remark}` : ""}`,
            "交易来源": "Payroll",
            "原欠款记录": String(entry.key || ""),
            "原欠款日期": String(entry.date || "")
          });
        });
      } else {
        // 兼容旧 Payroll：没有逐笔扣款 JSON 时保留项目总额历史。
        [
          ["支粮", Number(payroll["支粮扣款"] || 0) + Number(payroll["欠款其他扣款"] || 0) + Number(payroll["医疗扣款"] || 0)],
          ["准证", Number(payroll["准证扣款"] || 0)]
        ].forEach(([type, amount]) => {
          if (amount <= 0) return;
          repayments.push({
            "日期时间": date,
            "公司": payroll["公司"],
            "工人编号": payroll["工人编号"],
            "工人名字": payroll["工人名字"],
            "项目": type,
            "金额": -amount,
            "显示金额": -amount,
            "备注": `Payroll ${payrollMonth} 扣回`,
            "交易来源": "Payroll",
            "原欠款记录": ""
          });
        });
      }
    });

    payrollAbsenceStatusMap = refreshedAbsenceStatusMap;
    advanceLedgerCache = [
      ...advanceLedgerCache.filter(item => item["交易来源"] !== "Payroll"),
      ...repayments
    ];
    renderAdvanceLedger(advanceLedgerCache);
  } catch (_) {
    // Payroll 历史载入失败不影响欠款输入与保存。
  } finally {
    payrollRepaymentLoading = false;
  }
}

function normalizeAdvanceMonthKey(value) {
  const text = String(value || "").trim();
  if (/^\d{2}-\d{4}$/.test(text)) return text;
  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] = text.split("-");
    return `${month}-${year}`;
  }
  return text;
}

function monthKeyFromAdvanceDate(value) {
  const date = formatAdvanceDate(value);
  const match = String(date || "").match(/^\d{2}-(\d{2})-(\d{4})$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function buildAbsencePayrollKey(company, workerNo, month) {
  return [
    String(company || "").trim(),
    String(workerNo || "").trim(),
    normalizeAdvanceMonthKey(month)
  ].join("__");
}

function getAbsencePayrollStatus(item) {
  const month = monthKeyFromAdvanceDate(
    item["扣款日期"] || item["日期"] || item["日期时间"]
  );
  if (!month) return "待处理";

  const key = buildAbsencePayrollKey(
    item["公司"],
    item["工人编号"],
    month
  );
  return payrollAbsenceStatusMap.get(key) || "待处理";
}

function absenceStatusClass(status) {
  if (status === "已扣薪") return "absence-status-deducted";
  if (status === "免扣") return "absence-status-waived";
  return "absence-status-pending";
}

function payrollMonthEndDate(monthValue) {
  const text = String(monthValue || "").trim();
  const match = text.match(/^(\d{2})-(\d{4})$/);
  if (!match) return text;

  const month = Number(match[1]);
  const year = Number(match[2]);
  const day = new Date(year, month, 0).getDate();
  return `${String(day).padStart(2, "0")}-${match[1]}-${match[2]}`;
}

function handleCompanyChange() {
  renderWorkerOptions();
  clearUnsavedAdvanceInputs();
}

function handleWorkerChange() {
  clearUnsavedAdvanceInputs({ keepWorker: true });
  loadExistingAdvanceRecord();
}

function clearUnsavedAdvanceInputs({ keepWorker = false } = {}) {
  const form = document.getElementById("advanceForm");
  if (!form) return;

  if (!keepWorker) form.workerNo.value = "";
  form.type.value = DEFAULT_ADVANCE_TYPE;
  form.amount.value = "";
  form.amount.readOnly = false;
  form.amount.classList.remove("readonly-field");
  form.remark.value = "";
  delete form.amount.dataset.autoAbsence;
  editingAdvanceRow = null;

  const hint = document.getElementById("absenceHint");
  if (hint) hint.style.display = "none";

  setTodayDateDropdown(true);
}

function renderWorkerOptions() {
  const form = document.getElementById("advanceForm");
  if (!form) return;

  const company = form.company.value;
  const workerSelect = form.workerNo;
  const workers = workersCache
    .filter(worker => worker["公司"] === company)
    .sort((a, b) => String(a["工人编号"] || "").localeCompare(
      String(b["工人编号"] || ""), undefined, { numeric: true }
    ));

  workerSelect.innerHTML = '<option value="">选择工人</option>' + workers.map(worker => `
    <option value="${escapeHtml(worker["工人编号"])}">
      ${escapeHtml(worker["工人编号"])} · ${escapeHtml(worker["工人名字"])}
    </option>
  `).join("");
}

function handleProjectChange() {
  setTodayDateDropdown(false);
  updateAbsenceAmount();
  loadExistingAdvanceRecord();
}

function handleAdvanceKeyChange() {
  updateAbsenceAmount();
  loadExistingAdvanceRecord();
}

function loadExistingAdvanceRecord() {
  const form = document.getElementById("advanceForm");
  if (!form || !form.workerNo.value || !form.type.value) return;

  let date = "";
  try { date = getDeductDateValue(); } catch (_) { return; }

  const existing = advanceLedgerCache.find(item =>
    item["交易来源"] !== "Payroll" &&
    String(item["工人编号"] || "") === String(form.workerNo.value) &&
    String(item["项目"] || item["类型"] || "") === String(form.type.value) &&
    formatAdvanceDate(item["扣款日期"] || item["日期"] || item["日期时间"]) === date
  );

  if (!existing) {
    editingAdvanceRow = null;
    if (form.type.value !== "缺席") form.amount.value = "";
    form.remark.value = "";
    return;
  }

  editingAdvanceRow = Number(existing.row) || null;
  form.amount.value = formatMoneyInput(existing["金额"] || 0);
  form.remark.value = String(existing["备注"] || "");
  showStatus("status", `已载入 ${date} 的记录，可以直接修改`, true);
}

function updateAbsenceAmount() {
  const form = document.getElementById("advanceForm");
  const hint = document.getElementById("absenceHint");
  if (!form) return;

  const isAbsence = form.type.value === "缺席";
  form.amount.readOnly = isAbsence;
  form.amount.classList.toggle("readonly-field", isAbsence);

  if (hint) hint.style.display = isAbsence ? "block" : "none";

  if (!isAbsence) {
    if (form.amount.dataset.autoAbsence === "true") form.amount.value = "";
    delete form.amount.dataset.autoAbsence;
    return;
  }

  const worker = workersCache.find(worker =>
    String(worker["工人编号"]) === String(form.workerNo.value)
  );
  const month = Number(form.deductMonth.value);
  const year = Number(form.deductYear.value);

  if (!worker || !month || !year) {
    form.amount.value = "";
    form.amount.dataset.autoAbsence = "true";
    return;
  }

  const salaryType = String(worker["薪水类型"] || "");
  let amount = 0;

  if (salaryType === "日薪") {
    amount = parseCurrency(worker["日薪"]);
  } else if (salaryType === "月薪") {
    amount = parseCurrency(worker["月薪"]) / 30;
  }
  form.amount.value = amount > 0 ? formatMoneyInput(amount) : "";
  form.amount.dataset.autoAbsence = "true";
}

async function handleAdvanceSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const btn = document.getElementById("saveAdvanceBtn");

  try {
    const worker = workersCache.find(worker =>
      String(worker["工人编号"]) === String(form.workerNo.value)
    );

    if (!worker) throw new Error("请选择工人");
    if (!form.type.value) throw new Error("请选择项目");

    const deductDate = getDeductDateValue();
    updateAbsenceAmount();
    const amount = parseCurrency(form.amount.value);

    if (!form.amount.value.trim()) throw new Error("请输入金额");
    if (amount < 0) throw new Error("金额不能小于 0");

    if (amount === 0) {
      const confirmed = window.confirm("金额为 0，将删除这笔欠款记录。是否继续？");
      if (!confirmed) return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "保存中...";
    }

    const item = {
      company: form.company.value.trim(),
      workerNo: worker["工人编号"],
      workerName: worker["工人名字"],
      type: form.type.value.trim(),
      deductDate,
      amount,
      remark: form.remark.value.trim()
    };

    let result = null;
    if (editingAdvanceRow) {
      item.row = editingAdvanceRow;
      result = await api("updateAdvance", { item });
    } else {
      // 后端会在同工人 + 同日期 + 同项目时直接更新，避免第二次 API 请求。
      result = await api("addAdvance", { item });
    }

    if (result && result.deleted) {
      const deletedRow = Number(result.row || editingAdvanceRow || 0);
      advanceLedgerCache = advanceLedgerCache.filter(row =>
        row["交易来源"] === "Payroll" || Number(row.row) !== deletedRow
      );
    }

    const savedRecord = result && result.record ? result.record : null;
    if (savedRecord) {
      const index = advanceLedgerCache.findIndex(row =>
        Number(row.row) === Number(savedRecord.row) &&
        row["交易来源"] !== "Payroll"
      );

      if (index >= 0) advanceLedgerCache[index] = savedRecord;
      else advanceLedgerCache.push(savedRecord);
    }

    showStatus(
      "status",
      result && result.deleted
        ? "欠款记录已删除"
        : result && (result.updated || result.duplicate)
          ? "欠款记录已修改并保存到 Google Sheet"
          : "欠款记录已保存到 Google Sheet",
      true
    );

    updateAdvanceBrowserCache();
    form.reset();
    renderWorkerOptions();
    clearUnsavedAdvanceInputs();
    renderAdvanceLedger(advanceLedgerCache);
  } catch (error) {
    showStatus("status", error.message, false);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "保存记录";
    }
  }
}

async function loadAdvances(prefetchedAdvances = null) {
  if (prefetchedAdvances) advanceLedgerCache = prefetchedAdvances;
  else advanceLedgerCache = await api("getAdvanceLedger") || [];
  renderAdvanceLedger(advanceLedgerCache);
}

function toggleAdvanceHistory() {
  advanceHistoryVisible = !advanceHistoryVisible;
  const panel = document.getElementById("advanceHistoryPanel");
  const button = document.getElementById("toggleAdvanceHistoryBtn");

  if (panel) panel.hidden = !advanceHistoryVisible;
  if (button) button.textContent = advanceHistoryVisible ? "收起历史记录" : "欠款历史记录";

  if (advanceHistoryVisible) {
    renderAdvanceHistory(advanceLedgerCache);
    panel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function advanceDebtRecordKey(item, index = 0) {
  const date = String(item["日期时间"] || item["日期"] || item["扣款日期"] || "").trim();
  const type = String(item["项目"] || item["类型"] || "").trim();
  const amount = Number(item["金额"] || 0);
  const row = Number(item.row) || 0;
  return [date, type, amount.toFixed(2), row || index + 1].join("|");
}

function buildAdvanceGroups(advances) {
  const companyOrder = {
    "Lover Legend Adenium": 1,
    "Lover Legend Gardening": 2
  };

  const sorted = [...(advances || [])].sort((a, b) => {
    const companyA = companyOrder[String(a["公司"] || "")] || 99;
    const companyB = companyOrder[String(b["公司"] || "")] || 99;
    if (companyA !== companyB) return companyA - companyB;

    const workerA = String(a["工人编号"] || "");
    const workerB = String(b["工人编号"] || "");
    if (workerA !== workerB) return workerA.localeCompare(workerB, undefined, { numeric: true });

    return parseDDMMYYYY(b["扣款日期"] || b["日期"] || b["日期时间"]) -
      parseDDMMYYYY(a["扣款日期"] || a["日期"] || a["日期时间"]);
  });

  const groups = {};
  sorted.forEach(item => {
    const key = `${item["公司"] || ""}__${item["工人编号"] || ""}__${item["工人名字"] || ""}`;
    if (!groups[key]) {
      groups[key] = {
        company: item["公司"] || "",
        workerNo: item["工人编号"] || "",
        workerName: item["工人名字"] || "",
        borrowRecords: [],
        repaymentRecords: [],
        absenceRecords: []
      };
    }

    const type = String(item["项目"] || item["类型"] || "");
    const value = Number(item["显示金额"] ?? item["金额"]) || 0;
    if (type === "缺席") groups[key].absenceRecords.push(item);
    else if (value < 0 || item["交易来源"] === "Payroll") groups[key].repaymentRecords.push(item);
    else groups[key].borrowRecords.push(item);
  });

  return Object.values(groups);
}

function calculateOpenDebtRecords(group) {
  const paidByKey = new Map();
  let legacyRepayment = 0;

  group.repaymentRecords.forEach(item => {
    const value = Math.abs(Number(item["显示金额"] ?? item["金额"]) || 0);
    const key = String(item["原欠款记录"] || "").trim();
    if (key) paidByKey.set(key, (paidByKey.get(key) || 0) + value);
    else legacyRepayment += value;
  });

  const records = group.borrowRecords.map((item, index) => {
    const key = advanceDebtRecordKey(item, index);
    const amount = Number(item["金额"] || 0);
    const paid = Math.min(amount, paidByKey.get(key) || 0);
    return { item, key, amount, paid, remaining: Math.max(0, amount - paid) };
  });

  // 兼容旧版只有项目总扣款的 Payroll：按日期由新到旧冲销。
  records.forEach(record => {
    if (legacyRepayment <= 0 || record.remaining <= 0) return;
    const applied = Math.min(record.remaining, legacyRepayment);
    record.paid += applied;
    record.remaining -= applied;
    legacyRepayment -= applied;
  });

  return records;
}

function renderAdvanceLedger(advances) {
  const list = document.getElementById("advanceList");
  if (!list) return;

  const groups = buildAdvanceGroups(advances);
  if (!groups.length) {
    list.innerHTML = '<p class="muted">还没有记录。</p>';
    if (advanceHistoryVisible) renderAdvanceHistory(advances);
    return;
  }

  const cards = groups.map(group => {
    const openRecords = calculateOpenDebtRecords(group).filter(record => record.remaining > 0.005);
    const remainingTotal = openRecords.reduce((sum, record) => sum + record.remaining, 0);

    const debtHtml = openRecords.map(record => {
      const item = record.item;
      return `
        <div class="advance-ledger-line advance-open-debt-line">
          <span>
            ${escapeHtml(formatAdvanceDate(item["扣款日期"] || item["日期"] || item["日期时间"]))}
            · ${escapeHtml(item["项目"] || item["类型"])}
            · 未清 ${formatCurrency(record.remaining)}
          </span>
          ${String(item["备注"] || "").trim()
            ? `<div class="advance-ledger-note">备注：${escapeHtml(item["备注"])}</div>`
            : ""}
        </div>`;
    }).join("");

    const absenceHtml = group.absenceRecords.map(item => {
      const status = getAbsencePayrollStatus(item);
      return `
        <div class="advance-ledger-line absence-ledger-line">
          <span>${escapeHtml(formatAdvanceDate(item["扣款日期"] || item["日期"] || item["日期时间"]))}
          · 缺席 · ${formatCurrency(item["金额"])}
          · <strong class="absence-payroll-status ${absenceStatusClass(status)}">${escapeHtml(status)}</strong></span>
        </div>`;
    }).join("");

    if (!debtHtml && !absenceHtml) return "";

    return `
      <div class="worker-item advance-ledger-card">
        <div class="worker-name">${escapeHtml(group.workerNo)} · ${escapeHtml(group.workerName)} · ${escapeHtml(group.company)}</div>
        ${absenceHtml ? `<div class="advance-ledger-section-title">缺席记录</div><div class="advance-ledger-records absence-records">${absenceHtml}</div>` : ""}
        ${debtHtml ? `<div class="advance-ledger-section-title">目前未清欠款</div><div class="advance-ledger-records">${debtHtml}</div>
        <div class="advance-ledger-remaining">剩余欠款：${formatCurrency(remainingTotal)}</div>` : ""}
      </div>`;
  }).filter(Boolean).join("");

  list.innerHTML = cards || '<p class="muted">目前没有未清欠款。</p>';
  if (advanceHistoryVisible) renderAdvanceHistory(advances);
}

function renderAdvanceHistory(advances) {
  const list = document.getElementById("advanceHistoryList");
  if (!list) return;

  const groups = buildAdvanceGroups(advances);
  list.innerHTML = groups.map(group => {
    const history = [...group.borrowRecords, ...group.repaymentRecords]
      .sort((a, b) => parseDDMMYYYY(b["日期时间"] || b["日期"] || b["扣款日期"]) - parseDDMMYYYY(a["日期时间"] || a["日期"] || a["扣款日期"]));

    if (!history.length) return "";

    const totalBorrowed = group.borrowRecords.reduce((sum, item) => sum + (Number(item["金额"]) || 0), 0);
    const totalRepaid = group.repaymentRecords.reduce((sum, item) => sum + Math.abs(Number(item["显示金额"] ?? item["金额"]) || 0), 0);
    const remaining = Math.max(0, totalBorrowed - totalRepaid);

    const rows = history.map(item => {
      const value = Number(item["显示金额"] ?? item["金额"]) || 0;
      const isRepayment = value < 0 || item["交易来源"] === "Payroll";
      const date = formatAdvanceDate(item["日期时间"] || item["日期"] || item["扣款日期"]);
      const label = isRepayment
        ? String(item["备注"] || "Payroll 扣回")
        : `${item["项目"] || item["类型"]}${item["备注"] ? ` · ${item["备注"]}` : ""}`;

      return `<div class="advance-history-line ${isRepayment ? "is-repayment" : "is-borrow"}">
        <span>${escapeHtml(date)} · ${escapeHtml(label)}</span>
        <strong>${isRepayment ? "-" : "+"}${formatCurrency(Math.abs(value))}</strong>
      </div>`;
    }).join("");

    return `<div class="worker-item advance-history-card">
      <div class="worker-name">${escapeHtml(group.workerNo)} · ${escapeHtml(group.workerName)} · ${escapeHtml(group.company)}</div>
      <div class="advance-history-lines">${rows}</div>
      <div class="advance-ledger-remaining">当前未清欠款：${formatCurrency(remaining)}</div>
    </div>`;
  }).filter(Boolean).join("") || '<p class="muted">还没有欠款历史记录。</p>';
}

function setupDateDropdowns() {
  const form = document.getElementById("advanceForm");
  if (!form) return;

  fillSelect(form.deductDay, 1, 31, "日");
  fillSelect(form.deductMonth, 1, 12, "月");

  const currentYear = new Date().getFullYear();
  fillSelect(form.deductYear, 2010, currentYear + 5, "年");
}

function fillSelect(select, start, end, label) {
  if (!select) return;
  select.innerHTML = `<option value="">${label}</option>`;

  for (let i = start; i <= end; i++) {
    const value = String(i).padStart(2, "0");
    const display = label === "年" ? String(i) : value;
    select.innerHTML += `<option value="${display}">${display}</option>`;
  }
}

function setTodayDateDropdown(force = false) {
  const form = document.getElementById("advanceForm");
  if (!form) return;

  if (!force && form.deductDay.value && form.deductMonth.value && form.deductYear.value) return;

  const today = new Date();
  form.deductDay.value = String(today.getDate()).padStart(2, "0");
  form.deductMonth.value = String(today.getMonth() + 1).padStart(2, "0");
  form.deductYear.value = String(today.getFullYear());
}

function getDeductDateValue() {
  const form = document.getElementById("advanceForm");
  if (!form) return "";

  const d = form.deductDay.value;
  const m = form.deductMonth.value;
  const y = form.deductYear.value;

  if (!d || !m || !y) throw new Error("请选择日期");

  const value = `${d}-${m}-${y}`;
  if (!isValidDDMMYYYY(value)) throw new Error("日期无效，请重新选择");
  return value;
}

function isValidDDMMYYYY(value) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) return false;
  const [dd, mm, yyyy] = value.split("-").map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  return date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd;
}

function parseDDMMYYYY(value) {
  if (!value) return new Date(0);
  const text = String(value).trim();

  if (/^\d{2}-\d{2}-\d{4}/.test(text)) {
    const [dd, mm, yyyy] = text.substring(0, 10).split("-").map(Number);
    return new Date(yyyy, mm - 1, dd);
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return new Date(text);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [yyyy, mm, dd] = text.split("-").map(Number);
    return new Date(yyyy, mm - 1, dd);
  }

  return new Date(0);
}

function formatAdvanceDate(value) {
  if (!value) return "";
  const text = String(value).trim();

  if (/^\d{2}-\d{2}-\d{4}/.test(text)) return text.substring(0, 10);

  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const [y, m, d] = text.slice(0, 10).split("-");
    return `${d}-${m}-${y}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [y, m, d] = text.split("-");
    return `${d}-${m}-${y}`;
  }

  return text;
}

function formatInputMoney(input) {
  if (!input.value.trim()) return;
  input.value = formatMoneyInput(parseCurrency(input.value));
}

function formatMoneyInput(value) {
  const amount = Number(value) || 0;
  return amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parseCurrency(value) {
  return Number(String(value || "").replace(/[^\d.]/g, "")) || 0;
}

function formatSignedCurrency(value) {
  const amount = Number(value) || 0;
  if (amount < 0) return "-RM " + formatMoneyInput(Math.abs(amount));
  return "RM " + formatMoneyInput(amount);
}

function formatCurrency(value) {
  return "RM " + formatMoneyInput(value);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[char]));
}

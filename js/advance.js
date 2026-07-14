let workersCache = [];
let advanceLedgerCache = [];
let editingAdvanceRow = null;

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
  }

  loadAdvancePage();
});

async function loadAdvancePage() {
  try {
    const data = await api("getAdvanceBootstrap");
    workersCache = data?.workers || [];
    advanceLedgerCache = (data?.advances || []).map(item => ({
      ...item,
      "交易来源": "新增",
      "显示金额": Number(item["金额"]) || 0
    }));

    renderWorkerOptions();
    renderAdvanceLedger(advanceLedgerCache);
    showStatus("status", "系统已就绪，可以记录欠款", true);

    // Payroll 扣回记录放到后台载入，不阻塞“系统已就绪”。
    loadPayrollRepaymentsInBackground();
  } catch (error) {
    showStatus("status", error.message, false);
  }
}

async function loadPayrollRepaymentsInBackground() {
  try {
    const payrolls = await api("getPayrolls");
    const repayments = [];

    (payrolls || []).forEach(payroll => {
      const date = payroll["发薪日期"] || payrollMonthEndDate(payroll["月份"]);
      [
        [
          "支粮",
          Number(payroll["支粮扣款"] || 0) +
            Number(payroll["欠款其他扣款"] || 0) +
            Number(payroll["医疗扣款"] || 0),
          payroll["支粮扣款说明"] || payroll["其他扣款说明"]
        ],
        ["准证", payroll["准证扣款"], ""]
      ].forEach(([type, amount, note]) => {
        const value = Number(amount) || 0;
        if (value <= 0) return;

        repayments.push({
          "日期时间": date,
          "公司": payroll["公司"],
          "工人编号": payroll["工人编号"],
          "工人名字": payroll["工人名字"],
          "项目": type,
          "金额": -value,
          "显示金额": -value,
          "备注": `Payroll ${payroll["月份"]} 扣回${note ? ` · ${note}` : ""}`,
          "交易来源": "Payroll"
        });
      });
    });

    advanceLedgerCache = [
      ...advanceLedgerCache.filter(item => item["交易来源"] !== "Payroll"),
      ...repayments
    ];
    renderAdvanceLedger(advanceLedgerCache);
  } catch (_) {
    // Payroll 历史载入失败不影响扣款输入与保存。
  }
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
    const daysInMonth = new Date(year, month, 0).getDate();
    amount = daysInMonth > 0 ? parseCurrency(worker["月薪"]) / daysInMonth : 0;
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
    if (amount <= 0) throw new Error("金额必须大于 0");

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
      result && (result.updated || result.duplicate)
        ? "扣款记录已修改并保存到 Google Sheet"
        : "扣款记录已保存到 Google Sheet",
      true
    );

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

function renderAdvanceLedger(advances) {
  const list = document.getElementById("advanceList");
  if (!list) return;
  const companyOrder = {
    "Lover Legend Adenium": 1,
    "Lover Legend Gardening": 2
  };

  const sorted = (advances || []).sort((a, b) => {
    const companyA = companyOrder[String(a["公司"] || "")] || 99;
    const companyB = companyOrder[String(b["公司"] || "")] || 99;
    if (companyA !== companyB) return companyA - companyB;

    const workerA = String(a["工人编号"] || "");
    const workerB = String(b["工人编号"] || "");
    if (workerA !== workerB) {
      return workerA.localeCompare(workerB, undefined, { numeric: true });
    }

    const dateA = parseDDMMYYYY(a["扣款日期"] || a["日期"] || a["日期时间"]);
    const dateB = parseDDMMYYYY(b["扣款日期"] || b["日期"] || b["日期时间"]);
    return dateA - dateB;
  });

  if (!sorted.length) {
    list.innerHTML = '<p class="muted">还没有记录。</p>';
    return;
  }

  const groups = {};

  sorted.forEach(item => {
    const type = String(item["项目"] || item["类型"] || "");
    if (type === "缺席") return;

    const key = `${item["公司"] || ""}__${item["工人编号"] || ""}__${item["工人名字"] || ""}`;
    if (!groups[key]) {
      groups[key] = {
        company: item["公司"] || "",
        workerNo: item["工人编号"] || "",
        workerName: item["工人名字"] || "",
        borrowedTotal: 0,
        repaidTotal: 0,
        borrowRecords: [],
        repaymentRecords: []
      };
    }

    const value = Number(item["显示金额"] ?? item["金额"]) || 0;
    if (value < 0 || item["交易来源"] === "Payroll") {
      groups[key].repaidTotal += Math.abs(value);
      groups[key].repaymentRecords.push(item);
    } else {
      groups[key].borrowedTotal += value;
      groups[key].borrowRecords.push(item);
    }
  });

  list.innerHTML = Object.values(groups).map(group => {
    const remaining = Math.max(0, group.borrowedTotal - group.repaidTotal);
    return `
      <div class="worker-item advance-ledger-card">
        <div class="worker-name">${escapeHtml(group.workerNo)} · ${escapeHtml(group.workerName)} · ${escapeHtml(group.company)}</div>

        <div class="advance-ledger-records">
          ${group.borrowRecords.map(item => `
            <div class="advance-ledger-line">
              <span>${escapeHtml(formatAdvanceDate(item["扣款日期"] || item["日期"] || item["日期时间"]))} · ${escapeHtml(item["项目"] || item["类型"])} · ${formatCurrency(item["金额"])}</span>
            </div>
          `).join("")}
        </div>

        <div class="advance-ledger-total">累计欠款：${formatCurrency(group.borrowedTotal)}</div>

        ${group.repaymentRecords.length ? `
          <div class="advance-ledger-records repayment-records">
            ${group.repaymentRecords.map(item => {
              const source = String(item["备注"] || "Payroll 扣回").trim();
              const project = String(item["项目"] || item["类型"] || "").trim();
              const label = `${source}${project ? project : ""}`;
              return `
                <div class="advance-ledger-line repayment-line">
                  <span>${escapeHtml(label)} · ${formatSignedCurrency(item["显示金额"] ?? item["金额"])}</span>
                </div>
              `;
            }).join("")}
          </div>
        ` : ""}

        <div class="advance-ledger-remaining">剩余欠款：${formatCurrency(remaining)}</div>
      </div>
    `;
  }).join("");
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

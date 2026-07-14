let workersCache = [];
let editingWorkerNo = null;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("workerForm");
  const resignBtn = document.getElementById("resignWorkerBtn");

  if (resignBtn) {
    resignBtn.addEventListener("click", handleResignWorker);
  }

  if (form) {
    setupDateDropdowns();

    form.addEventListener("submit", handleWorkerSubmit);

    form.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
      }
    });

    form.salaryType.addEventListener("change", handleSalaryType);

    form.company.addEventListener("change", () => {
      const selectedCompany = form.company.value;

      form.reset();
      form.company.value = selectedCompany;
      editingWorkerNo = null;

      setSaveButtonText("保存工人");
      showResignButton(false);
      handleSalaryType();
      renderWorkerNameList();

      showStatus("status", "已切换公司，请选择或输入工人名字", true);
    });

    form.name.addEventListener("change", () => {
      handleWorkerNameSelect(form.name.value);
    });

    form.name.addEventListener("input", () => {
      const text = form.name.value.trim();

      if (!text) {
        clearWorkerDetailsForNew();
        return;
      }

      handleWorkerNameSelect(text);
    });

    form.salaryAmount.addEventListener("blur", () => {
      formatInputMoney(form.salaryAmount);
    });

    handleSalaryType();
  }

  loadWorkers();
});

async function loadWorkers() {
  try {
    workersCache = await api("getWorkers") || [];
    renderWorkersFromCache();
  } catch (error) {
    showStatus("status", error.message, false);
  }
}

function renderWorkersFromCache() {
  renderWorkerNameList();

  const box = document.getElementById("workerList");
  if (!box) return;

  if (!workersCache.length) {
    box.innerHTML = '<p class="muted">还没有工人资料。</p>';
    showStatus("status", "系统已就绪，可以正常使用", true);
    return;
  }

  box.innerHTML = workersCache.map(worker => `
    <div class="worker-item" onclick="editWorker('${escapeJs(worker["工人编号"])}')">
      <div class="worker-name">
        ${escapeHtml(worker["工人编号"])} · ${escapeHtml(worker["工人名字"])}
      </div>
      <div class="muted">
        ${escapeHtml(worker["公司"])} · ${escapeHtml(worker["薪水类型"])} · ${escapeHtml(worker["状态"])} · ${displaySalary(worker)}
      </div>
    </div>
  `).join("");

  showStatus("status", "系统已就绪，可以正常使用", true);
}

function renderWorkerNameList() {
  const list = document.getElementById("workerNameList");
  const form = document.getElementById("workerForm");

  if (!list || !form) return;

  const selectedCompany = String(form.company.value || "").trim();

  const filteredWorkers = workersCache.filter(worker =>
    String(worker["公司"] || "").trim() === selectedCompany
  );

  list.innerHTML = filteredWorkers.map(worker => `
    <option value="${escapeHtml(worker["工人名字"])}">
  `).join("");
}

function handleWorkerNameSelect(name) {
  const form = document.getElementById("workerForm");
  const selectedCompany = String(form.company.value || "").trim();
  const text = String(name || "").trim();

  if (!text) {
    clearWorkerDetailsForNew();
    return;
  }

  const matchedWorkers = workersCache.filter(w =>
    String(w["公司"] || "").trim() === selectedCompany &&
    String(w["工人名字"] || "").trim().toUpperCase() === text.toUpperCase()
  );

  if (matchedWorkers.length === 1) {
    editWorker(matchedWorkers[0]["工人编号"]);
    return;
  }

  clearWorkerDetailsForNew();
  form.name.value = text;

  if (matchedWorkers.length > 1) {
    showStatus("status", "同名工人超过一个，请从下面列表点击选择", false);
  } else {
    showStatus("status", "新增工人模式", true);
  }
}

function clearWorkerDetailsForNew() {
  const form = document.getElementById("workerForm");
  if (!form) return;

  editingWorkerNo = null;

  if (form.workerNo) form.workerNo.value = "";
  form.phone.value = "";
  form.ic.value = "";
  form.salaryType.value = "";
  form.salaryAmount.value = "";
  form.joinDay.value = "";
  form.joinMonth.value = "";
  form.joinYear.value = "";
  form.remark.value = "";

  handleSalaryType();
  setSaveButtonText("保存工人");
  showResignButton(false);

  showStatus("status", "新增工人模式", true);
}

function resetWorkerForm() {
  const form = document.getElementById("workerForm");
  if (!form) return;

  form.reset();
  editingWorkerNo = null;

  setSaveButtonText("保存工人");
  showResignButton(false);
  handleSalaryType();
  renderWorkerNameList();

  showStatus("status", "新增工人模式", true);
}

function editWorker(workerNo) {
  const worker = workersCache.find(w => String(w["工人编号"]) === String(workerNo));

  if (!worker) {
    showStatus("status", "找不到这个工人", false);
    return;
  }

  const form = document.getElementById("workerForm");

  editingWorkerNo = workerNo;

  if (form.workerNo) form.workerNo.value = worker["工人编号"] || "";

  form.company.value = worker["公司"] || "";
  renderWorkerNameList();

  form.name.value = worker["工人名字"] || "";
  form.phone.value = worker["电话"] || "";
  form.ic.value = worker["IC / Passport"] || "";
  form.salaryType.value = worker["薪水类型"] || "";

  if (worker["薪水类型"] === "日薪") {
    form.salaryAmount.value = worker["日薪"] ? formatMoneyInput(worker["日薪"]) : "";
  } else if (worker["薪水类型"] === "月薪") {
    form.salaryAmount.value = worker["月薪"] ? formatMoneyInput(worker["月薪"]) : "";
  } else {
    form.salaryAmount.value = "";
  }

  setDateDropdownValue(worker["入职日期"] || "");

  form.remark.value = worker["备注"] || "";

  handleSalaryType();
  setSaveButtonText("更新工人");
  showResignButton(true);

  window.scrollTo({ top: 0, behavior: "smooth" });
  showStatus("status", "正在编辑：" + workerNo + " · " + worker["工人名字"], true);
}

async function handleWorkerSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const btn = document.getElementById("saveWorkerBtn");

  try {
    const joinDate = getJoinDateValue();

    if (btn) {
      btn.disabled = true;
      btn.textContent = editingWorkerNo ? "更新中..." : "保存中...";
    }

    const salaryAmount = parseCurrency(form.salaryAmount.value);
    if (!form.salaryAmount.value.trim()) {
  throw new Error("请输入薪水");
}

if (salaryAmount <= 0) {
  throw new Error("请输入正确的薪水金额");
}
      const worker = {
      workerNo: editingWorkerNo,
      company: form.company.value.trim(),
      name: form.name.value.trim(),
      phone: String(form.phone.value).trim(),
      ic: form.ic.value.trim(),
      salaryType: form.salaryType.value.trim(),
      dailySalary: form.salaryType.value === "日薪" ? salaryAmount : "",
      monthlySalary: form.salaryType.value === "月薪" ? salaryAmount : "",
      joinDate: joinDate,
      status: "在职",
      remark: form.remark.value.trim()
    };

    if (editingWorkerNo) {
      const result = await api("updateWorkerByNo", { worker });
      const record = result && result.record ? result.record : null;
      if (record) {
        const index = workersCache.findIndex(item => String(item["工人编号"]) === String(record["工人编号"]));
        if (index >= 0) workersCache[index] = record;
      }
      showStatus("status", "工人资料已更新并保存到 Google Sheet", true);
    } else {
      const result = await api("addWorker", { worker });
      if (result && result.record) workersCache.push(result.record);
      showStatus("status", "工人资料已保存到 Google Sheet", true);
    }

    resetWorkerForm();
    renderWorkersFromCache();
  } catch (error) {
    showStatus("status", error.message, false);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = editingWorkerNo ? "更新工人" : "保存工人";
    }
  }
}

async function handleResignWorker() {
  if (!editingWorkerNo) {
    showStatus("status", "请先选择一个工人", false);
    return;
  }

  const form = document.getElementById("workerForm");
  const workerName = form.name.value.trim();

  const ok = confirm("确定要将 " + editingWorkerNo + " · " + workerName + " 办理离职？");
  if (!ok) return;

  try {
    const result = await api("resignWorker", {
      workerNo: editingWorkerNo,
      workerName: workerName
    });

    workersCache = workersCache.filter(item => String(item["工人编号"]) !== String(editingWorkerNo));
    showStatus("status", "工人已办理离职并保存到 Google Sheet", true);
    resetWorkerForm();
    renderWorkersFromCache();
  } catch (error) {
    showStatus("status", error.message, false);
  }
}

function setupDateDropdowns() {
  const form = document.getElementById("workerForm");
  if (!form) return;

  fillSelect(form.joinDay, 1, 31, "日");
  fillSelect(form.joinMonth, 1, 12, "月");

  const currentYear = new Date().getFullYear();
fillSelect(form.joinYear, 2010, currentYear + 5, "年");
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

function getJoinDateValue() {
  const form = document.getElementById("workerForm");
  if (!form) return "";

  const d = form.joinDay.value;
  const m = form.joinMonth.value;
  const y = form.joinYear.value;

  if (!d && !m && !y) return "";

  if (!d || !m || !y) {
    throw new Error("入职日期不完整。如果要填写，请选择日、月、年。");
  }

  const value = `${d}-${m}-${y}`;

  if (!isValidDDMMYYYY(value)) {
    throw new Error("入职日期无效，请重新选择。");
  }

  return value;
}

function setDateDropdownValue(value) {
  const form = document.getElementById("workerForm");
  if (!form) return;

  const normalized = normalizeDateDDMMYYYY(value);

  if (!normalized || !isValidDDMMYYYY(normalized)) {
    form.joinDay.value = "";
    form.joinMonth.value = "";
    form.joinYear.value = "";
    return;
  }

  const [d, m, y] = normalized.split("-");

  form.joinDay.value = d;
  form.joinMonth.value = m;
  form.joinYear.value = y;
}

function normalizeDateDDMMYYYY(value) {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) return text;

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

function isValidDDMMYYYY(value) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) return false;

  const [dd, mm, yyyy] = value.split("-").map(Number);
  const date = new Date(yyyy, mm - 1, dd);

  return date.getFullYear() === yyyy &&
    date.getMonth() === mm - 1 &&
    date.getDate() === dd;
}

function handleSalaryType() {
  const form = document.getElementById("workerForm");
  const label = document.getElementById("salaryAmountLabel");

  if (!form || !label) return;

  if (form.salaryType.value === "日薪") {
    label.textContent = "日薪 RM";
  } else if (form.salaryType.value === "月薪") {
    label.textContent = "月薪 RM";
  } else {
    label.textContent = "薪水 RM";
  }
}

function displaySalary(worker) {
  if (worker["薪水类型"] === "日薪") return formatCurrency(worker["日薪"]);
  if (worker["薪水类型"] === "月薪") return formatCurrency(worker["月薪"]);
  return "RM 0.00";
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

function formatCurrency(value) {
  return "RM " + formatMoneyInput(value);
}

function setSaveButtonText(text) {
  const btn = document.getElementById("saveWorkerBtn");
  if (btn) btn.textContent = text;
}

function showResignButton(show) {
  const resignBtn = document.getElementById("resignWorkerBtn");
  if (resignBtn) resignBtn.style.display = show ? "block" : "none";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[char]));
}

function escapeJs(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

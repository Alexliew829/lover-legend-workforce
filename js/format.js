function formatCurrency(value) {
  const n = Number(String(value || "0").replace(/[^0-9.-]/g, ""));
  return "RM " + (isNaN(n) ? 0 : n).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parseCurrency(value) {
  const n = Number(String(value || "0").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function normalizeDateDDMMYYYY(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const parts = raw.replace(/[\/\.]/g, "-").split("-");
  if (parts.length !== 3) return raw;

  let [dd, mm, yyyy] = parts;
  dd = dd.padStart(2, "0");
  mm = mm.padStart(2, "0");

  if (yyyy.length === 2) yyyy = "20" + yyyy;
  return `${dd}-${mm}-${yyyy}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[m]));
}

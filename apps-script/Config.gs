/*************************************************
 * Lover Legend Workforce ERP
 * Config.gs
 *************************************************/

const SPREADSHEET_ID = "170dnQg0tiuLxNftIcJBs8oyaJUtYe2aL1vI9SnBbBtI";

const SHEETS = {
  COMPANY: "公司设置",
  WORKERS: "工人资料",
  ADVANCE: "支粮费用",
  ATTENDANCE: "出勤记录",
  PAYROLL: "Payroll",
  PAYSLIP: "Payslip",
  DASHBOARD: "Dashboard",
  AUDIT: "AuditLog"
};
function db() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}
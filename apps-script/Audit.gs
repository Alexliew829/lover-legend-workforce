/*************************************************
 * Lover Legend Workforce ERP
 * Audit.gs
 *************************************************/

function auditLog(action, detail) {
  const sh = db().getSheetByName(SHEETS.AUDIT);

  sh.appendRow([
    new Date(),
    getCurrentUser_(),
    action,
    detail
  ]);
}

function getCurrentUser_() {
  const email = Session.getActiveUser().getEmail();
  return email || "Unknown";
}
/*************************************************
 * Lover Legend Workforce ERP
 * Database.gs
 *************************************************/

function setupDatabaseV2() {
  const ss = db();

  createSheet_(ss, SHEETS.COMPANY, ["公司名称", "状态"]);

  createSheet_(ss, SHEETS.WORKERS, [
  "工人编号",
  "公司",
  "工人名字",
  "电话",
  "IC / Passport",
  "薪水类型",
  "日薪",
  "月薪",
  "入职日期",
  "状态",
  "备注"
]);

  createSheet_(ss, SHEETS.ADVANCE, [
    "日期时间", "公司", "工人编号", "工人名字", "项目", "金额", "备注"
  ]);

  createSheet_(ss, SHEETS.ATTENDANCE, [
    "月份", "公司", "工人名字", "工作天", "缺席天", "备注"
  ]);

  createSheet_(ss, SHEETS.PAYROLL, [
    "月份", "公司", "工人编号", "工人名字", "薪水类型", "工作天数",
    "日薪", "月薪", "基本薪水", "缺席天数", "缺席处理", "缺席应扣金额",
    "缺席扣款", "支粮扣款", "准证扣款", "医疗扣款", "欠款其他扣款",
    "其他工资扣款", "总扣款", "实发薪水", "备注"
  ]);

  createSheet_(ss, SHEETS.PAYSLIP, []);
  createSheet_(ss, SHEETS.DASHBOARD, []);

  createSheet_(ss, SHEETS.AUDIT, [
    "日期时间", "使用者", "动作", "内容"
  ]);

  seedCompany_();

  Logger.log("Database V2 setup completed");
}

function createSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);

  if (!sh) {
    sh = ss.insertSheet(name);
  }

  sh.clear();

  if (headers.length > 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sh.getRange(1, 1, 1, headers.length).setBackground("#d9ead3");
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  }
}

function seedCompany_() {
  const ss = db();
  const sh = ss.getSheetByName(SHEETS.COMPANY);

  sh.getRange(2, 1, 2, 2).setValues([
    ["Lover Legend Adenium", "Active"],
    ["Lover Legend Gardening", "Active"]
  ]);
}

function autoResizeWorkforceSheets_() {
  const ss = db();
  ss.getSheets().forEach(sh => {
    const lastColumn = sh.getLastColumn();
    if (lastColumn <= 0) return;

    sh.autoResizeColumns(1, lastColumn);
    sh.getRange(1, 1, 1, lastColumn).setWrap(true);

    for (let column = 1; column <= lastColumn; column++) {
      const currentWidth = sh.getColumnWidth(column);
      if (currentWidth < 90) sh.setColumnWidth(column, 90);
      if (currentWidth > 260) sh.setColumnWidth(column, 260);
    }
  });
  return true;
}

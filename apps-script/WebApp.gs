function doGet(e) {
  return jsonOutput({
    success: true,
    message: "LL Workforce API V1.7 Running",
    version: "1.7"
  });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    const action = data.action;

    if (action === "getWorkers") {
      return jsonOutput({ success: true, data: getWorkers() });
    }

    if (action === "addWorker") {
      return jsonOutput({ success: true, data: addWorker(data.worker), message: "工人已新增" });
    }

    if (action === "updateWorkerByNo") {
      return jsonOutput({ success: true, data: updateWorkerByNo(data.worker), message: "工人资料已更新" });
    }

    if (action === "resignWorker") {
      return jsonOutput({ success: true, data: resignWorker(data.workerNo, data.workerName), message: "工人已离职" });
    }

    if (action === "getAdvances") {
      return jsonOutput({ success: true, data: getAdvances() });
    }

    if (action === "getAdvanceLedger") {
      return jsonOutput({ success: true, data: getAdvanceLedger() });
    }

    if (action === "addAdvance") {
      return jsonOutput({ success: true, data: addAdvance(data.item) });
    }

    if (action === "updateAdvance") {
      return jsonOutput({ success: true, data: updateAdvance(data.item) });
    }

    if (action === "getPayrolls") {
      return jsonOutput({ success: true, data: getPayrolls() });
    }

    if (action === "getPayrollBootstrap") {
      return jsonOutput({
        success: true,
        data: {
          workers: getWorkers(),
          advances: getAdvances(),
          payrolls: getPayrolls()
        }
      });
    }

    if (action === "getPayrollData") {
      return jsonOutput({
        success: true,
        data: { advances: getAdvances(), payrolls: getPayrolls() }
      });
    }


    if (action === "clearCache") {
      return jsonOutput({ success: true, data: clearWorkforceCache_() });
    }

    if (action === "autoResizeAllSheets") {
      autoResizeWorkforceSheets_();
      return jsonOutput({ success: true, data: true });
    }

    if (action === "savePayroll") {
      return jsonOutput({ success: true, data: savePayroll(data.payroll) });
    }

    return jsonOutput({
      success: false,
      message: "Unknown action: " + action
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: err.message
    });
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

# V5.3 Enterprise Stable

- 系统资料 Revision 改为「Revision（上次 → 当前）」格式，例如 310 → 311。
- Payment Date 不能为空；新 Payroll 默认当天，电脑端可修改并保存。
- 修改 Payment Date 后，Payslip 立即读取该笔 Payroll 已保存日期，不再按月份自动改成次月 1 日。
- 编辑既有 Payroll 时保留原本已保存 Payment Date，不会被当天日期覆盖。
- 手机端继续 Read Only，只显示该笔 Payroll 已保存 Payment Date。
- 所有用户可见日期继续统一 dd-mm-yyyy。

# V5.3 Enterprise Stable

- 首页新增统一「系统状态 / 重新检查」，正常不展开；异常点击状态才显示检查重点。
- Dashboard 年底结转下新增「系统资料」。
- Payment Date 电脑端固定显示 dd-mm-yyyy，选择/保存时不再变灰；手机端继续 Read Only 并显示已保存日期。
- 所有现有工资、欠款、Payslip 计算逻辑保持不变。

# V5.3 Enterprise Stable

- Based strictly on V5.0 Enterprise Stable.
- Payment Date for a new Payroll defaults to the current date.
- Desktop: saved Payroll cards show an editable Payment Date beside the Payslip action; changing it updates only that Payroll snapshot date.
- Mobile: Payment Date is visible but read-only.
- Reopening or reprinting a saved Payroll/Payslip keeps the saved Payment Date; it does not change to the current date.
- Payroll salary, deduction, debt, absence and Payslip calculations are unchanged.
- Current UI/API/resource/cache/package versions updated to V5.3 / API 5.3.0.

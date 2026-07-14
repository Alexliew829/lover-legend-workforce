# V1.83.1.1 Stable

- Added Dashboard with month/year selection.
- Shows worker count, paid/unpaid workers, monthly net payroll, company summaries, outstanding balances, payroll progress and absence summary.
- Refreshed Windows, Android, iPhone and browser icons using the approved red-P Payroll icon.
- Updated PWA cache to V1.83.1.1 Stable.

# V1.74
- 修正 Payroll 列表只显示所选月份。
- 月底总数统计所选月份两间公司的全部实发工资。

- Payroll 列表在“实发”下面显示“欠款余额”，使用红色粗体。
- Payroll 列表最下面显示所选月份的实发工资总数。
- Payroll Google Sheet 新增“欠款余额”栏位。
- Payroll 保存改为使用后端回传记录更新本地列表，移除保存前后两次重复读取。
- 全系统 API 加入短时间读取缓存与相同请求合并，减少重复网络请求。
- Apps Script 不再每次 API 请求检查 Google Sheet 格式。
- Payroll 保存不再每次执行整表去重与排序，缩短保存时间。
- 版本更新为 V1.74。

# V1.72

- 扣款管理列表将工人编号、名字与公司名称合并在同一行。
- Payroll 扣回记录删除日期，改为“Payroll 月份 扣回项目 · -RM 金额”。
- Payroll 列表在没有缺席时不显示“缺席 0 天 / 免扣”。
- Payroll 列表在没有任何扣款时不显示“总扣款”。
- 本版只修改前端显示，Apps Script 后端不需要重新部署。

# V1.7

- Apps Script 新增 CacheService 缓存：工人、扣款与 Payroll 读取更快。
- 新增资料、修改资料、办理离职及保存 Payroll 后自动清除相关缓存，避免显示旧资料。
- 删除每次储存都自动调整整份 Google Sheet 栏宽的慢速流程；需要时可手动执行 `autoResizeAllSheets`。
- Worker 保存及离职后直接采用后端回传的新名单，不再额外读取一次。
- 扣款管理首次载入时并行读取工人与账目；保存后直接使用后端回传账目。
- Payroll 保存后直接更新前端记录与欠款计算，不再额外发出第二次 API 请求。
- Payroll 读取时不再重复执行整表排序与重复资料清理；这些维护只在保存时执行。
- Payroll 列表“实发”独立最后一行。
- Apps Script 后端版本更新为 V1.7，必须重新部署 Web App。

# V1.6.3

- Payroll 列表改为三行紧凑显示：工人编号、名字与公司同一行。
- Payroll 列表删除发薪日期，只显示月份与本月工资。
- 缺席、处理方式、总扣款与实发薪水合并在同一行。
- 选择公司后立即从本地缓存显示工人名单。
- 选择工人或月份时先即时显示薪水与现有资料，再读取最新扣款及 Payroll，减少等待感。
- 版本更新为 V1.6.3。

# V1.6.2

- Payroll 切换公司或工人时立即清空所有未保存资料。
- Payroll 首次载入改为一次 API 请求，减少等待时间。
- Payroll 重新读取扣款与工资资料时改为合并请求。
- 扣款管理列表分开显示原始欠款、Payroll 扣回和剩余欠款。
- Payroll 扣回说明改为同一行右侧显示，不再另列备注。
- Google Sheet 自动调整所有工作表栏宽，并限制过窄或过宽。
- 版本更新为 V1.6.2。

## V1.6.1
- Payroll 网页与 Google Sheet 改为公司优先、工人编号其次、月份再次排序。
- Payroll 列表日期统一为 dd-MM-yyyy，并新增发薪日期字段。
- 每次选择工人、切换月份或保存前，重新读取扣款与 Payroll，避免修改扣款后显示旧余额。
- 扣款管理列表加入 Payroll 扣回记录，显示负数流水及最新累计欠款。
- Payroll 重复记录自动保留同工人同月份最后一笔，旧重复行自动清理。
- 工人、扣款、Payroll 保存后自动调整所有 Google Sheet 栏宽。

# Changelog

## V1.6 Preview
- 工人管理继续采用双栏布局：薪水类型与薪水金额并排。
- 扣款管理：工人与项目并排。
- 扣款项目调整为：缺席、支粮、准证、其他；删除新建“医疗”选项。
- 扣款管理选择“缺席”后，金额改为 Readonly 自动计算：
  - 日薪工人：自动使用一天日薪。
  - 月薪工人：月薪 ÷ 所选月份实际天数。
- Payroll 删除工作天数及其他工资扣款输入。
- Payroll 工人与薪水类型并排，薪水与本月工资并排显示。
- Payroll 欠款列表固定显示：缺席、支粮、准证、其他。
- Payroll 右侧只输入“本月扣除”，并即时显示扣后剩余。
- 本月扣除不能超过项目欠款，总扣款不能超过本月工资。
- 自动计算总扣款、实发薪水与扣款后剩余欠款。
- 旧“医疗”欠款在 Payroll 中合并到“其他”，避免旧资料遗失。
- 首页版本更新为 V1.6 Preview。

## V1.5 Stable
- 全系统采用紧凑双栏布局，减少手机与电脑页面下拉。
- 工人管理：薪水类型与薪水金额并排。
- 扣款管理：工人与项目并排，保留重复记录确认修改与累计欠款。
- Payroll：公司筛选工人、工人与薪水类型并排、自动读取日薪/月薪。
- Payroll：欠款以项目列表显示，可输入本月分期扣款。
- Payroll：自动计算基本薪水、总扣款、实发薪水及剩余欠款。
- 新增 Payroll.gs、getPayrolls、savePayroll。
- 首页版本更新为 V1.5 Stable。


## V1.6 Stable
- 扣款管理项目默认选择“支粮”。
- 切换公司或工人时，清空未保存金额和备注，避免记错工人。
- 缺席金额保持自动计算及 Readonly。
- Payroll 月薪员工只显示“本月工资 RM”，不再重复显示月薪。
- Payroll 按所选月份统计缺席记录，并支持“扣薪 / 免扣”。
- 免扣仍保存缺席天数和应扣金额，方便年度查询。
- 支粮、准证、其他支持分期扣除，并显示扣后余额。
- 同一工人同一月份再次保存 Payroll 时更新原记录，不重复新增。


## V1.75
- Payroll list refreshes immediately by selected month.
- Print Payslip button uses Chinese and English.
- Admin Payslip page uses Chinese and English.
- Printed payslip uses Malay and English.
- One A4 page prints employee and company copies with a cut line.
- PDF title includes worker name and month.
- Payslip month is bold black.
- Home page adds green and red Lover Legend logos.
- Added Windows, Android and iPhone icons plus PWA manifest.


## V1.76
- Updated desktop and mobile Payroll System icons.
- Integrated the Payroll and Payslip entry points into a single Payroll module.
- Removed the separate Payslip card from the home page.
- Updated frontend cache version to V1.76.

## V1.83.1.1 Stable
- Performance-only release based on V1.77.
- Faster Dashboard summary loading through one backend endpoint.
- Reduced repeated API calls during Advance and Worker workflows.
- Local list updates after save to reduce full-sheet rereads.
- Existing payroll, debt, payslip and sorting logic retained.


## V1.83.1.1 Stable
- Existing Advance records auto-load by worker, date and item.
- Dates saved as dd-MM-yyyy text to avoid day/month reversal.
- Payroll and Payslip show deduction purpose from Advance remarks.
- Removed unnecessary Payroll refresh calls and Advance sheet sorting on every save.

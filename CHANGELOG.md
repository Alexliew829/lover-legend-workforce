# V3.5 Enterprise Stable

- 修复 Google Sheet 有 07-2026 Payroll，但网页显示“没有 Payroll 记录”的问题。
- 自动识别并迁移 Restore 后的旧 Payroll Sheet 栏位结构到当前 canonical schema。
- 迁移只整理栏位与日期格式，不重新计算工资、不修改真实欠款本金。
- 旧 Payroll 若工人编号缺失，会优先用公司 + 工人名字从 Worker 主资料安全补回。
- 保留原 Payroll 的发薪日期、津贴、佣金、缺席处理、扣款明细 JSON、已打印及打印时间。
- Payslip 继续由恢复后的原 Payroll 动态生成，无需重新输入 7 月 Payroll。
- Backup 前强制整理 Payroll 为当前 schema，避免未来 Backup 再保存旧栏位结构。
- Restore 后立即迁移 Payroll，再验证每笔 Payroll 的月份 / 公司 / 工人 / 发薪日期 / 已打印 / 扣款明细可读取性。
- Restore 失败继续自动回滚。
- 所有页面、API、Cache、Service Worker、Apps Script Bundle 与资源版本统一为 V3.5。

# V3.4 Enterprise Stable

- 修复 Restore 后过去 Payroll / Payslip 网页读取不到的问题。
- Payroll 月份读取兼容 Restore 产生的 `01-07-2026 00:00:00` 等旧日期文字，并正确识别为 `07-2026`。
- Restore 写回 Payroll 时，“月份”统一恢复为 `MM-yyyy` 文字格式，避免再次发生月份错位。
- Restore 前增加完整性检查：必须包含 Worker、Advance、Payroll 等关键工作表及必要表头；不完整备份直接禁止恢复。
- Restore 前自动保留当前系统服务器快照。
- Restore 后自动验证 Worker、Advance、Payroll 数量。
- Restore 验证失败时自动回滚至 Restore 前状态，避免失败恢复覆盖真实资料。
- Restore 成功后前端强制清除读取缓存，并显示验证后的 Worker / Advance / Payroll 数量。
- Backup schema / 系统页面 / API / Cache / Service Worker / 资源版本统一为 V3.4。

# V3.3 Enterprise Stable

- 修复 Lover Legend Adenium 旧月份带入欠款没有显示的问题。
- 当前月份显示所有目前仍未清的欠款，包括以前月份带过来的余额。
- 查询过去月份时，显示该月份当时存在的欠款，并把后来实际还款直接挂在原欠款后。
- 删除每一笔欠款下面重复的“截至 XX-XXXX 未清”文字。
- 每位工人卡片底部统一显示还款 / 扣款汇总。
- 缺席“已扣薪”计入对应 Payroll 结算日的已清金额；免扣与待处理不计。
- 例如 W0006：RM200 + RM200 支粮扣回，加 RM60 缺席扣薪，显示“01-08-2026 已清欠款：RM460.00”。
- 仍有余额时只显示一次“当前未清欠款”，已完全清偿则不再显示未清余额。
- 所有页面、API、Cache、Service Worker 与资源版本统一为 V3.3。

# V3.2 Enterprise Stable

- 欠款管理保存后保留公司、工人、项目及日期，方便立即检查。
- 选择过去月份时，下方欠款资料跟随所选月份，不再固定显示当前月份。
- 过去月份的未清欠款按该月月底状态计算；当前月份按今天实时状态计算。
- 每笔借款直接显示对应还款日期与金额，不再显示“Payroll XX-XXXX 扣回”文字。
- 欠款历史改为“一笔借款 → 自己的还款流水”，支持一笔借款分多次还款。
- 借款 + 金额为青色，还款 - 金额为红色。
- 所有页面、API、Cache、Service Worker 与资源版本统一为 V3.2。

# V3.2 Enterprise Stable

- 修复：编辑已有欠款时允许把金额改为 RM0。
- RM0 只用于修正已有错误欠款；新增欠款仍必须大于 RM0。
- 编辑为 RM0 时弹出二次确认，确认后从目前欠款资料删除。
- 删除错误欠款后，Payroll 不再读取该笔记录。
- AuditLog 保留原金额与“原金额 → RM0（删除）”修正轨迹。
- 前端与 Apps Script 均加入验证，避免新增 RM0 欠款。
- 全系统页面、API、Cache、Service Worker 与资源版本统一为 V3.2。

# V3.2 Enterprise Stable

- 欠款历史：借款（+）统一显示在上方并改为青色；Payroll 还款（-）统一显示在下方并改为红色。
- 每位工人历史卡显示累计欠款、Payroll 累计扣回及当前未清欠款。
- 年底结转前自动把 Advance、Payroll、Payslip、Dashboard、AuditLog 保存到 Google Sheet 历史归档。
- 年底结转后只结转尚未还清的支粮与准证；已处理缺席及已还清欠款不再显示。
- Payroll 已保存后不能再次直接保存，必须从列表进入编辑模式。
- 已打印 Payroll 修改前必须二次确认，且更新后保留原打印状态与打印时间。
- 全系统版本统一更新为 V3.2。

# V3.2 Enterprise Stable

- Advance Bootstrap 由 Apps Script 直接回传 Payroll 缺席处理状态。
- 已出粮并扣薪显示“已扣薪”；已出粮但免扣显示“免扣”；未出粮显示“待处理”。
- 同一工人同一月份的全部缺席采用统一状态。
- 缺席不计入累计欠款。
- 保留 V2.4.2 手机完整查看模式及桌面全部功能。
- 统一页面、manifest、Apps Script API、Service Worker 与 API Cache 版本为 V3.2。

# V2.5 Absence Payroll Status

- Advance 缺席记录按工人、公司和月份对应已保存的 Payroll。
- Payroll 选择扣薪后，整个月缺席显示“已扣薪”。
- Payroll 选择免扣后，整个月缺席显示“免扣”。
- 尚未保存 Payroll 的月份显示“待处理”。
- 缺席仍不计入累计欠款，V2.4.2 其他逻辑保持不变。
- Apps Script 接口不需新增；继续使用现有 getPayrolls 资料。

# V2.4 Mobile Query Fix

- 手机 Payroll 恢复月份、年份、公司及工人查询。
- 手机仍禁止保存、编辑、删除和打印。
- 手机可打开 Payslip 查看，打印按钮继续隐藏。
- 更新 PWA 缓存为 v241，避免继续载入旧版锁定逻辑。
- Apps Script 与 Google Sheet 逻辑没有修改。

# V2.5 Stable

- Worker names now support up to 30 characters across the frontend and backend.

- Payroll records are permanently retained after saving, including normal salary records with no deductions.
- Monthly-salary absence deduction is fixed at monthly salary ÷ 30.
- Frontend, Service Worker, manifest, API response, backup metadata, and cache keys are aligned to V2.4.
- Print Payslip and Payroll selection restoration fixes retained.

# V1.88 Stable

- Added editable paid work days for daily-wage Payroll.
- Added Apps Script write locks.
- Payslip lookup now includes company.
- Unified frontend, PWA cache and API version to V1.88.

# V1.86 Stable

- Added Dashboard with month/year selection.
- Shows worker count, paid/unpaid workers, monthly net payroll, company summaries, outstanding balances, payroll progress and absence summary.
- Refreshed Windows, Android, iPhone and browser icons using the approved red-P Payroll icon.
- Updated PWA cache to V1.86 Stable.

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

## V1.86 Stable
- Performance-only release based on V1.77.
- Faster Dashboard summary loading through one backend endpoint.
- Reduced repeated API calls during Advance and Worker workflows.
- Local list updates after save to reduce full-sheet rereads.
- Existing payroll, debt, payslip and sorting logic retained.


## V1.86 Stable
- Existing Advance records auto-load by worker, date and item.
- Dates saved as dd-MM-yyyy text to avoid day/month reversal.
- Payroll and Payslip show deduction purpose from Advance remarks.
- Removed unnecessary Payroll refresh calls and Advance sheet sorting on every save.


## V2.4.2 Mobile Full View
- 手机可查询月份、年份、公司及工人。
- 手机完整显示逐笔扣款明细、余额、本月扣除及累计欠款。
- 金额与备注仅可查看，不能编辑。
- 保存、编辑、删除及打印仍限制在电脑端。

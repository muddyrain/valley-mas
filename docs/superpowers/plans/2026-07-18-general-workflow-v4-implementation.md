# P11：通用工作流内核 Graph v4 实施记录

## 状态

P11 已完成。Graph v4 代码、自动化回归和核心编辑器浏览器交互均已落地；用户已在实际页面确认画布对齐辅助线、新工作流链路和封面节点的新语义。既有工作流数据按当前决策保留，不作为关闭门槛。

## 服务端

- `WorkflowNodeRegistry` 只注册 8 类通用节点；`WorkflowCapabilityRegistry` 注册 5 个受控 Tool Adapter。
- `GraphValidator` 统一校验版本、结构、DAG、引用类型、条件分支可跳过输出、`when`、Merge、预算和工具白名单；可跳过输出只能进入可选 Tool 输入或先经过 Merge，唯独节点 `when` 产生的可跳过值可直接映射到显式声明为 `string` 的 End 输出，运行时会稳定返回空字符串。
- 运行时按活动边调度，未命中分支或 `when` 记录 `skipped`；Tool 事件与 `WorkflowNodeRun` 保存 `capabilityId`。
- Subworkflow 锁定 owner 已发布版本，保存时递归检查引用，运行时使用版本快照并阻止递归。
- 创建、普通保存、Graph/Subworkflow 校验和 AI App 不可变草稿版本同步共用同一事务；预算检查覆盖传递子工作流。
- 工作流副驾驶在编辑场景仅接收 operations；服务端应用到基础图后再验证和计算差异。明确的可选封面需求使用确定性 operations，避免模型整图重写。
- 提案 baseHash / candidateHash 使用前后端共享规范化 JSON 规则，并以中文键名和 HTML 转义字符共享向量回归，避免合法提案被误判过期。
- `/workflows/ai-draft` 保留路径但只生成 Graph v4。
- 新增 `purge-legacy-workflows` 命令与事务清理服务，包含环境、确认词、dry-run 和保留数据测试。

## Web

- 工作台信息架构拆分为智能体项目页 `/workbench` 与独立工作流页 `/workbench/workflows`；项目页的智能体创建统一使用“标准创建 / AI 创建”双 Tab 弹窗，工作流页独立承载模板、普通创建和 AI 创建。现有知识库入口 `/workbench/knowledge` 在导航中归入资源库，插件和提示词暂不创建无后端能力的占位入口。
- 画布移除旧 `NodePanel` 和业务专用属性表单，新增 shadcn Popover / Sheet 节点选择器。
- 支持底部添加、普通节点后插入和连线插入；条件分支要求使用具体 true/false 连线入口。
- 通用 Tool 表单消费能力 Schema；模板全部改为 `tool` + capability ID。
- 工作流统一序列化为 Graph v4；AI 协作一级 Tab 不随节点选择改变。
- 右栏一级 Tab 调整为“节点信息 / AI 协作”并默认打开节点信息；未保存工作流显示稳定空状态，不再渲染聊天气泡骨架。
- 节点插入统一使用主链自动让位布局，下游节点与其后继整体右移；边与连接预览统一使用贝塞尔曲线。
- 节点卡和 LLM 属性表单显示统一输出契约；LLM 固定输出 `text`、`model`、`tokenUsage`，End 可从变量按钮直接选择具体“节点 · 字段”。
- 变量引用改为可点击的原子 Token；底层继续保存规范引用，界面显示“节点名 · 变量名”。点击或聚焦后在 Token 位置打开可输入筛选的变量选择器，删除时整体移除。输入 `{{` 只触发候选，不再向草稿写入临时 `{{}}`。
- End 与 LLM 输入复用统一变量绑定表单；LLM 输入支持命名、类型与上游变量映射，服务端在解析引用后按名称排序并随用户提示词传入模型。
- 连线添加按钮改为对应边 hover / focus 时显示，使用 28px 透明命中区域保证曲线容易悬停，同时保留键盘焦点入口。
- P11 关闭前补充画布智能对齐辅助线：在 `onNodeDrag` 中从当前拖拽节点与其余可见节点计算左/中/右、上/中/下候选锚点，按缩放后的 6–8px 屏幕阈值选择一个水平和一个垂直命中；在 React Flow viewport 内以 flow 坐标渲染基准线，并将拖拽节点吸附到命中坐标。拖拽结束后清理辅助线，原有“仅结束时保存快照”的性能约束不变。优先复用 `@xyflow/react`，不新增依赖；内置 `snapToGrid` 只作为可选后备。
- 修正连线插入按钮的重复 translate，使按钮落在贝塞尔曲线真实中点；按钮使用主色小圆形入口，常态不遮挡画布。
- 拖拽过程中不再逐帧创建撤销快照、触发保存修订或重建 AI 草稿 JSON，拖拽结束时一次性提交；节点卡采用 memo，画布仅渲染可见节点。
- Start 参数名使用稳定的草稿输入，结束编辑后再提交，避免逐字输入导致控件重建；画布仅 Delete 删除节点，Backspace 保留为文本编辑键。
- 变量候选 Popover 使用文本光标的虚拟锚点定位；LLM 明确区分可选系统提示词和必填用户提示词，节点警告直接展示具体配置原因。
- End 支持输出名、类型和值映射，可选择上游变量并自动同步变量类型；前后端共同校验输出引用类型。
- 试运行结果改为通用 JSON 输出，仅在 End 实际返回站内路径时展示打开结果入口，不再假定所有工作流都会创建博客草稿。
- 节点运行快照在画布主卡下使用共享可折叠详情展示，运行与失败自动展开，成功后保留用户展开状态；主卡 Handle 留在固定包装层，详情高度不会拖动连线锚点。
- 新建页运行会先创建草稿；ARK 配置缺失、上游失败、超时和无效响应不再统一吞成 `WORKFLOW_NODE_FAILED`，运行面板可展示安全原因与稳定错误码。

## 数据与迁移

- `WorkflowNodeRun` 增加可选 `CapabilityID`，迁移为 `059_add_workflow_node_run_capability_id.sql`。
- P10 Graph v3 与业务节点代码、节点栏、旧模板和旧属性表单已由 P11 替代。

## 2026-07-18 验证记录

已通过：

- `pnpm --filter @valley/web exec tsc --noEmit`
- `pnpm --filter @valley/web build`
- `pnpm --filter @valley/web test:ai-workbench-sse`
- 仅针对本次 34 个变更 Web 源文件的 Biome check
- `cd server && go test ./...`
- `cd server && go build ./...`
- `git diff --check`
- 清理命令的环境保护、dry-run、事务回滚和保留数据自动化测试

环境阻塞：

- `pnpm check:harness` 在当前 Windows 环境无法通过 WSL 挂载启动；Git Bash 等价复跑可执行检查，但仓库的 `.claude/.codex/.codebase/.trae/skills` 在 Windows 中不是 Unix symlink，Harness 因此拒绝。
- Web 全量 `check` 仍有 15 个既存文件的格式错误和 34 个既存 lint warning；本次变更文件定向检查为零错误。
- 开发库 dry-run 连接 `localhost:3306/valley` 被拒绝，未取得清理数量，因此未执行 `--confirm DELETE_LEGACY_WORKFLOWS`。
- 可登录工作台与真实 ARK 普通 LLM 运行、空白 AI 创建、封面局部提案及封面节点真假运行均已由用户在实际环境验收。

编码检查脚本对 4 个重写文件报告“中文减少且问号增加”；逐项核对 diff 后确认中文减少来自移除 Graph v2/v3 专用文案，新增问号均为 TypeScript 可选链或条件表达式，不是乱码或文本丢失。

## 2026-07-18 编辑器配置与运行诊断补充验证

- Chrome 登录态通过：Start 参数名连续输入 `topic` 后焦点保持；Backspace 不删除选中节点，Delete 删除且撤销可恢复。
- Chrome 登录态通过：输入 `{{` 后变量候选位于光标下方 10px；End 选择 LLM `tokenUsage` 后输出类型自动切换为 `number`。
- Chrome 登录态通过：新建页运行按钮可用；验收改动完成后刷新恢复为两个空白基础节点，未创建测试工作流。
- Go 定向测试覆盖 LLM 可选系统提示词、End 输出类型映射、ARK 配置错误文案和运行记录错误码。

## 2026-07-18 画布与输出契约补充验证

- Chrome 登录态通过：在 Start 与 End 的连线上插入 LLM 后，三个节点保持同一主线且间距为节点宽度加 96px；下游节点自动让位，不再向下折线堆叠。
- Chrome 登录态通过：工作流边为三次贝塞尔曲线；拖拽 LLM 后节点位置和两条边实时同步，拖拽结束后画布状态正常。
- Chrome 登录态通过：右栏默认选择“节点信息”；选择“AI 协作”后再选择或拖拽节点，一级 Tab 保持不变；未保存工作流无 Skeleton，显示稳定空状态。
- Chrome 登录态通过：LLM 卡片和属性表单展示 `text`、`model`、`tokenUsage`；End 新增输出后可直接选择“大模型 · text”，并写入 `{{llm-id.output.text}}` 引用。
- Encoding Guard 对重写后的 `WorkflowNode.tsx` 报告中文减少且问号增加；定向检查确认中文减少来自移除旧 Graph v2/v3 节点文案，新增问号全部是可选链、空值合并或条件表达式，不是乱码或文本丢失。

## 2026-07-18 变量交互与连线入口补充验证

- Chrome 登录态通过：点击已有 `{{start.output.input1}}` Token 后在原位置显示变量候选；选择同一变量后引用保持完整。
- Chrome 登录态通过：选中 Token 后 Backspace 会整体删除，编辑器内容为空且无 `}}` 残留；输入 `{{` 后内容保持为两个左括号，删除后恢复为空。
- Chrome 登录态通过：LLM 新增 `input1` 后可直接选择“开始 · input1”，类型自动保持为 `string`；输出区继续展示 `text`、`model`、`tokenUsage`。
- Chrome 登录态通过：连线按钮默认 `opacity: 0 / pointer-events: none`，鼠标进入 28px 曲线命中区后切换为可见和可点击。
- Go 回归覆盖 LLM 结构化输入进入最终提示词，以及 LLM 输入引用的声明类型校验。
- Encoding Guard 对 `validateWorkflowConfig.ts` 报告中文减少且问号增加；定向核对确认中文减少来自 P11 移除旧节点校验文案，新增问号均为 TypeScript 可选字段和条件表达式，不是乱码或文本丢失。

## 2026-07-18 变量可读性与画布运行详情补充验证

- Chrome 登录态通过：连线视觉路径不再覆盖 28px hover 命中层；鼠标位于可见线条正中时按钮可见，按钮中心与贝塞尔路径中点坐标一致。
- 自动保存增加前端 Graph 结构与节点配置预检；新增节点尚未接入主链或配置未完成时只显示“待完善”，不再重复请求服务端或弹出草稿无效通知，用户主动保存或运行时仍会定位首个问题。
- Chrome 登录态通过：变量绑定获得焦点后，弹层搜索框自动获得焦点；输入 `input` 后实时保留唯一候选。选择后界面显示“开始 · input1”，DOM 底层仍保存 `{{start.output.input1}}`。
- Chrome 登录态通过：已有变量 Token 点击后重新打开搜索框，普通和选中候选分别使用背景、边框、主色图标与类型标记区分。
- 真实 ARK 登录态试运行通过：Start、LLM、End 均在画布主卡下产生可折叠运行详情，展示状态、耗时、输入和输出。折叠 Start 详情前后所有 Handle 坐标保持不变。
- 验收创建的临时未命名工作流已从开发库删除，未保留测试资产。

## 2026-07-18 画布智能对齐辅助线实施

- 新增 `workflowAlignment.ts` 纯坐标计算模块：拖拽节点会与其他节点的左、中、右、上、中、下锚点比较；中心锚点优先，再按距离选择命中项。阈值按 viewport 缩放换算为稳定的 8px 屏幕手感。
- 新增 `WorkflowAlignmentGuides`：通过 `ViewportPortal` 在 flow 坐标系绘制主色虚线水平/垂直基准线，使用 `pointer-events: none`，不干扰节点、连线或插入按钮交互。
- `WorkflowEditor` 在拖拽期间只更新临时对齐状态和画布位置；节点变更在拖拽结束时再次吸附并沿用原有提交路径，因此不新增逐帧撤销快照或自动保存。
- 自动布局尺寸同步为 264px 节点宽、144px 基准高，修复节点卡已经扩宽而插入布局仍按旧 220px 计算的间距偏差。
- 静态验证通过：本次 4 个 Web 文件的 Biome check、`pnpm --filter @valley/web exec tsc --noEmit`（由 build 覆盖）和 `pnpm --filter @valley/web build`。当前会话没有可用的浏览器控制入口，仍需在登录态人工验收：不同缩放下拖拽到中心/边缘锚点时的吸附、虚线位置与拖拽结束后的持久化。

## 2026-07-18 用户验收补充

- 用户在实际登录态页面确认：拖拽节点时会显示对齐辅助线。
- 用户在实际环境确认：新工作流可创建并走通运行链路。
- 本记录据此不再将“辅助线是否可见”“新 Graph v4 工作流是否可运行”或“封面节点新语义”列为待验项；既有数据保留，不进行旧工作流清理。封面节点默认直接生成，需要时仅在节点“生成条件”绑定已有上游布尔变量。

## 2026-07-18 真实 ARK 封面节点验收（已完成）

- 用户在实际环境确认：空白 AI 创建工作流可完成，封面局部提案可生成并应用。
- 用户确认新提案只插入封面节点、不新增 Start 输入；默认运行时封面节点成功生成一次。绑定已有上游布尔变量时，`false` 节点显示 `skipped` 且零生成调用，`true` 时仅生成一次。

## 2026-07-18 配置开发库清理 dry-run（已取消后续清理）

- 在用户授权后，以 `ENV=development`、`DB_DRIVER` 和 `DB_DSN` 注入清理进程，执行 `go run ./cmd/purge-legacy-workflows --dry-run`。命令连接配置开发库成功，`DB_AUTO_MIGRATE=false`，未执行迁移。
- 统计范围：`workflows` 44、`workflow_runs` 19、`workflow_node_runs` 72、`ai_apps` 19、`ai_app_versions` 169、`ai_app_runs` 16、`copilot_sessions` 9、`copilot_messages` 7；其余关联绑定、知识库、对话、公开调用与提案均为 0。
- 命令明确输出 `dry-run complete; no rows changed`。随后核对 `targetIDs` 发现它对 `workflows` 使用无版本过滤的全表查询，并选中所有 `type=workflow` 或带 `workflow_id` 的 AI App；44 条并不能被视为“仅旧 Graph”范围。用户已决定保留既有数据，因此不再修正或执行该清理路径。

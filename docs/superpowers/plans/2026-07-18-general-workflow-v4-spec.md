# P11：通用工作流内核 Graph v4 规格

## 目标

以通用节点和受控能力注册表替换 Graph v2/v3 业务节点，使编辑器、运行时和 AI 协作共享同一能力边界。旧 Graph 不迁移；开发数据通过显式、受保护命令清理。

## Graph v4

- 节点固定为 `start`、`end`、`llm`、`tool`、`condition`、`merge`、`variable`、`subworkflow`。
- 业务能力固定为 Tool capability：`content.parseMarkdown`、`knowledge.retrieve`、`content.search`、`image.generateCover`、`blog.createDraft`。
- 一个 Start、一个 End、最多 30 节点，只允许 DAG。
- `condition` 只有 `true` / `false` 输出；`merge` 使用 `firstActive`；Tool、LLM、Variable、Subworkflow 可声明受控 `when`，未命中输出字段为 `null` 并记录 `skipped`。
- LLM 的系统提示词可选，用于持续角色和边界；用户提示词必填，用于本次执行任务。End 通过“输出名 / 类型 / 值”映射返回固定值或上游变量，并校验引用类型。
- 单次最多 5 个模型能力、3 个写入能力；不开放代码、任意 HTTP、SQL、循环、批处理、自动发布、任意数据库写入或外部凭据。
- Subworkflow 只引用当前 owner 的不可变已发布版本，保存和运行都检查直接或传递递归。

## 编辑器与 AI

- 移除常驻节点栏；桌面使用 Popover、移动端使用全高 Sheet，从底部按钮、节点后加号和连线中部加号打开。
- Start / End 自动创建且不进入选择器；节点分组为大模型、流程控制、工具、子工作流。
- Tool 属性由能力 Schema 渲染；其他通用节点保留专用表单。
- 参数名编辑期间保持输入焦点；画布只使用 Delete 删除选中节点。变量选择器锚定到当前文本光标，不占用面板底部固定位置。
- 变量引用在编辑器中作为原子 Token：草稿保存规范引用，界面显示“节点名 · 变量名”；点击或聚焦已有 Token 可在原位置搜索、更换变量，Backspace / Delete 删除整个 Token，不得残留半个引用或自动补出的 `}}`。
- 节点插入时自动为下游节点让位并保持主链水平排布；工作流边使用可随拖拽实时更新的贝塞尔曲线。
- 连线中部的添加按钮默认隐藏，仅在对应连线 hover 或键盘聚焦时出现；每条连线只提供一个插入入口。
- 连线使用水平切线的贝塞尔曲线，插入按钮必须位于曲线几何中点，不得因重复位移偏离线条。
- 右栏一级 Tab 顺序固定为“节点信息 / AI 协作”，默认打开节点信息；用户手工切换后，选择或拖动节点不得擅自改变一级 Tab。AI 协作仅在真实请求期间展示加载状态，空白或未保存工作流展示稳定空状态。
- 每类节点必须声明可引用的输出字段契约。LLM 固定暴露 `text`、`model`、`tokenUsage`，节点卡和属性表单同时展示；End 通过节点与字段关联选择上游输出，不要求用户手写引用。
- LLM 支持命名输入变量绑定：每个输入声明名称和类型，并从上游节点输出或固定值取值；运行时在引用解析后将结构化输入随用户提示词传入模型。LLM 输出仍使用固定字段契约，由下游节点选择具体字段。
- 节点拖拽期间只更新画布瞬时状态，拖拽结束后再提交草稿快照、撤销记录和自动保存，避免逐帧序列化整张图。
- 试运行时每个已执行或跳过的节点在画布卡片下展示可展开详情，包含状态、耗时、输入、输出和安全错误；详情展开不得改变主卡 Handle 的连线锚点。
- 空白创建返回完整 Graph v4；已有工作流修改只返回 operations，服务端基于 baseHash 应用、完整校验并生成候选草稿和语义差异。
- operations 固定为 Start 输入增删、节点插入/修改/删除和边连接/断开；AI 不保存、运行、发布或调用工具。
- 可选封面需求必须只增加 Start boolean 和 `tool/image.generateCover`，通过节点 `when` 控制，不创建 Condition，不改动其他节点。

## 数据清理

- `go run ./cmd/purge-legacy-workflows --dry-run` 默认只统计。
- 仅 `ENV=development` 且显式传入 `--confirm DELETE_LEGACY_WORKFLOWS` 才在单事务内硬删除旧工作流、运行、工作流副驾驶和关联 workflow AI App 数据。
- 保留智能体 App、知识库和 API Key；只解除 API Key 与旧 workflow App 的绑定。

## 验收

- Graph v2/v3 固定拒绝并包含 `GRAPH_VERSION_UNSUPPORTED`。
- 未命中的模型和写入能力零调用；节点运行记录包含 `nodeType` 和可选 `capabilityId`。
- 新建草稿可直接点击运行并先完成持久化；ARK 缺配置、上游失败、超时和无效响应返回可行动的安全原因与稳定错误码。
- 三种节点入口、键盘/焦点、响应式、主题、AI operations 与撤销闭环通过。
- 完整命令以 `docs/PROJECT_GUIDE.md` 为准；真实 ARK 至少验证空白生成、封面局部提案及开关真假运行。

# P13.3.1：Notion 只读搜索能力实施计划

## 状态

已实现并由用户在真实 Notion 工作区验收。基于 [设计规格](../specs/2026-07-20-p13-notion-search-capability-design.md)。

## 1. Notion 读取服务

1. [x] 在既有 Notion 集成服务中增加 owner-scoped 搜索方法，复用加密连接读取和固定超时。
2. [x] 调用 Notion 搜索 API，校验与裁剪响应，转换为受限的页面/数据源元信息。
3. [x] 定义不泄露 token、授权码、原始响应或查询内容的错误与审计策略。
4. [x] 为连接缺失、owner 隔离、上游失败、响应裁剪和审计记录增加服务测试。

## 2. Graph v4 capability 接入

1. [x] 在既有 registry 注册只读 `notion.search` capability，声明输入、输出、描述和只读预算属性。
2. [x] 为工具节点实现 capability executor；只能使用工作流 owner 的连接。
3. [x] 保持现有图校验、版本快照、运行事件和错误映射；不新增通用 HTTP 或新节点类型。
4. [x] 为 schema、输入边界、执行成功、未连接与跨 owner 场景增加 workflow/handler 测试。

## 3. Web 接入

1. [x] 复用现有工具节点配置界面与 capability schema，不新增专用表单页面。
2. [x] 在节点选择和运行详情中显示“搜索 Notion”及受限结果摘要。
3. [x] 未连接状态提供跳转至“工具”页的指引；不在编辑器内重复 OAuth 流程。
4. [x] 补充 API 类型和必要的前端逻辑测试，并完成真实连接环境人工验收。
5. [x] 已连接状态提供“添加授权页面”指引，说明在 Notion 页面内添加 Valley，并说明项目根目录的子页面继承访问范围。

## 4. 文档与验证

1. [x] 更新 P13 路线图，明确 Notion OAuth 连接管理与只读搜索能力的完成状态。
2. [x] 运行相关 Go 测试、`go test ./...`、Web 类型检查、定向 Web 校验、编码检查和 Harness 检查。
3. [x] 使用真实 Notion 工作区执行查询，确认只返回受限元信息且没有产生 Notion 写入；补充授权项目根目录后，验证其新建子页面可被检索。

## 实施顺序

先完成服务端响应收敛与测试，再注册 workflow capability，最后接入 Web 配置与运行详情；每一步保持既有 OAuth 连接管理可独立使用。

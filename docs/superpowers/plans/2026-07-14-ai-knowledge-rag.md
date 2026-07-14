# Valley AI 知识库与 RAG 实施计划

> 状态：Markdown/TXT 核心链路、真实索引进度与单篇删除已完成；PDF 摄取与 PostgreSQL/ARK 实库验收待补

## 目标

为个人私有 AI 工作台提供知识库、文档摄取、pgvector 检索和带引用的 RAG 上下文；所有资源按 owner 隔离，embedding 不可用时明确失败。

## 阶段 A：知识库与文档摄取基础

- [x] 扩展 `AIKnowledgeDocument`，增加原文件元数据、解析文本和索引状态；新增 `AIKnowledgeChunk` 保存切块文本、序号、token 估计和预留向量字段。
- [x] 新增 PostgreSQL 迁移：启用 `vector` 扩展，创建向量列与 owner/文档索引；MySQL 环境明确将资料索引标记为失败，不降级为关键词检索。
- [x] 在 `server/internal/aiclient` 增加 ARK embedding 配置读取，使用 `ARK_EMBEDDING_MODEL` 接入点；已同步 `server/.env.example`。
- [~] 新增知识库 CRUD、Markdown/TXT 文档上传、删除、重试和状态查询接口；限制文件大小、每文档分段数。PDF 待实现。
- [x] Web 新增 `/workbench/knowledge` 入口与文档列表，显示待处理、索引中、成功、失败状态与真实索引进度；支持删除单篇文档及其分段。

## 阶段 B：异步解析、切块与检索

- [~] 实现 Markdown/TXT 文本提取；PDF 仅在可用解析器成功提取时入库，否则记录 `DOCUMENT_PARSE_FAILED`。（PDF 待实现。）
- [x] 以固定窗口和重叠长度切块，异步调用 ARK embedding，并在单一文档事务状态中记录成功或失败。
- [x] 实现 owner + 知识库绑定校验后的 pgvector Top-K 检索，使用固定相似度阈值与上下文长度上限。
- [x] 返回文档名、chunk ID 与文本摘要，禁止返回原文件或未授权知识库内容。

## 阶段 C：智能体 RAG 与引用

- [x] 增加应用—知识库绑定管理接口和智能体编辑器的绑定选择。
- [x] 调试运行前检索已绑定知识库，将安全片段注入系统上下文。
- [x] SSE `done` 事件和非流式返回增加引用数组；运行记录只保存引用摘要。
- [~] 增加 owner 隔离、embedding 配置缺失、解析失败、删除清理和引用返回的服务端测试。（配置与 owner 隔离已覆盖；真实 PostgreSQL/ARK 集成待人工验收。）

## 验证

- `cd server && go test ./...`
- `pnpm --filter @valley/web exec tsc --noEmit`
- `pnpm --filter @valley/web check`
- `pnpm check:harness`
- PostgreSQL 环境手动验证：上传 TXT/Markdown → 索引成功 → 智能体回答含引用；缺少 embedding 配置时返回 503。

# AI Agent Content Search Date Filter Design

> 状态：已交付；日期工具、fake ARK 请求捕获、handler 与全量 Go 回归已通过，真实浏览器已确认日期检索。Harness 仍受本机 WSL、Python 命令解析和符号链接 checkout 环境阻塞；真实 ARK 的其他会话场景仍待后续验收

## 目标

让已绑定 `content.search` 的 AI 工作台智能体能将“七月份写过什么博客”“上个月的文章”等时间表达转换为确定的日期范围，并只返回当前 owner 在该范围内创建的博客。实现已覆盖 CST 边界、独立日期端点、关键词叠加、输入错误与最多 5 条的倒序结果。

## 范围

- `content.search` 新增可选的 `createdFrom` 和 `createdTo` 参数，格式固定为 `YYYY-MM-DD`。
- `query` 改为可选；关键词与日期范围至少要提供一项。
- 日期范围按中国标准时间解析，`createdFrom` 为当天 00:00（含），`createdTo` 为次日 00:00（不含）。
- 日期范围存在时只查询 `Post.CreatedAt`，包含草稿；不查询资源，避免“博客”时间查询混入资源。
- 绑定 `content.search` 的调试和私有会话会向模型注入当天的中国标准时间，帮助模型将相对时间和未写年份的月份标准化。

## 非目标

- 不新增前端输入控件、数据库字段、迁移或环境变量。
- 不支持在服务端直接解析任意中文时间短语；时间理解由模型完成，工具只接受明确日期。
- 不改变 owner 隔离、工具绑定、最大 5 条结果、SSE 工具轨迹或公开 API 行为。

## 工具契约

```json
{
  "query": "可选关键词",
  "createdFrom": "2026-07-01",
  "createdTo": "2026-07-31"
}
```

- `query` 省略或为空时，日期范围仍可独立查询。
- `createdFrom` / `createdTo` 都必须是合法日历日期；若起始日期晚于结束日期，工具返回受控输入错误。
- 只有关键词时，保留当前博客与资源的关键词搜索行为。
- 日期范围出现时，博客查询会同时叠加关键词（若提供），并以 `created_at DESC` 排序。

## 提示词上下文

当智能体存在已绑定工具时，系统提示词追加一行运行时生成的当前日期，例如：

```text
当前日期（中国标准时间）：2026-07-16。处理相对日期或未写年份的月份时，先换算为明确的 YYYY-MM-DD 日期范围，再调用工具。
```

这不依赖模型自行猜测当前年份；没有工具绑定的普通调试路径不追加该上下文。

## 验收

1. `{"createdFrom":"2026-07-01","createdTo":"2026-07-31"}` 只返回 owner 在七月创建的博客，不要求标题或正文出现“七月”。
2. 相同范围不会返回八月、其他 owner 的博客或资源。
3. 空条件、错误日期、倒置日期范围均返回输入错误且不查询数据库。
4. fake ARK 捕获的绑定 `content.search` 调试与私有会话 system message 都带有当前中国标准时间和 `YYYY-MM-DD` 归一化指令；未绑定调试请求保持原始 system prompt。工具 schema 同时暴露新字段与使用说明。
5. 既有纯关键词博客/资源搜索回归通过。

## 已完成验证

- `cd server && go test ./internal/ai/tools/content -count=1`：通过，覆盖日期范围、单独 `createdFrom` / `createdTo`、关键词叠加、非法/倒置范围、owner 隔离、资源排除与最多 5 条倒序结果。
- `cd server && go test ./internal/handler -run TestAIAppContentSearchDateContextReachesARKOnlyWhenBound -count=1`：通过；fake ARK 捕获验证绑定 `content.search` 的私有会话与调试请求都含当前中国标准时间和 `YYYY-MM-DD`，未绑定调试请求保留原始 prompt。
- `cd server && go test ./internal/handler -count=1`：通过。
- `cd server && go test ./...`：通过。
- `pnpm check:harness`：本轮已尝试但以 exit 1 失败；其 WSL Bash 包装器在挂载 `ext4.vhdx` 时 HCS 返回 `ERROR_PATH_NOT_FOUND`。Git Bash 直接运行同样受环境阻塞：`python3` 解析到 Windows Store 占位程序；显式映射已安装 Python 后，Harness 发现 Git 兼容符号链接在此 checkout 被检出为普通文件。
- 真实浏览器已确认日期检索结果；ARK 上游的其余会话场景仍待端到端验收。

# AI 动态表情工作台实施计划

> 状态：生图 GIF 已作为默认链路落地，视频模型保留为可选增强；真实付费模型生成等待人工复验
> 日期：2026-08-09
> 设计：`docs/specs/2026-08-08-ai-motion-stickers-design.md`

## Task 1：模型目录与 AMUX 视频协议

- [x] 新增 `video_generation`、`video_protocol` 与 Admin 表单；视频连接检测保留为真实生成冒烟，不把空探测误报为已验证。
- [x] 新增 Provider 中立视频客户端与 AMUX 通用协议 Adapter。
- [x] 补齐请求、状态归一化、下载边界和能力校验测试。

## Task 2：持久任务、存储与转码

- [x] 新增动态表情模型和 PostgreSQL/MySQL 迁移。
- [x] 新增单用户并发约束、owner 隔离、持久 worker 和重启恢复。
- [x] 转存参考图与 MP4，接入 FFmpeg 校验和 GIF 派生。
- [ ] 转码失败保留 MP4并支持独立重试。

## Task 3：Web 动态表情工作台

- [x] 新增 API 类型、创建、列表、详情、鉴权内容读取和删除封装；AMUX 无取消端点，转码重试留待下一阶段。
- [x] 新增 `/workbench/gifs` 页面、标题与侧栏入口。
- [x] 支持上传约束、动作描述、模型选择、阶段反馈、GIF 预览和 MP4/GIF 下载。
- [x] 支持刷新、离页后恢复及 owner 私有历史。

## Task 4：共享工具与长期文档

- [x] 暴露页面、智能体和工作流可复用的服务与 `motion_sticker.generate` 异步任务工具契约。
- [x] 同步 `docs/PROJECT_GUIDE.md`、计划索引、迁移和部署说明。
- [x] 明确智能体返回任务卡、工作流按任务 ID 等待的后续 Transport Adapter 接入点。

## Task 5：验证

- [x] 服务端图片/视频 Adapter、队列/worker、工具契约、Handler 和迁移定向测试通过；`go test ./internal/... ./cmd/... ./migrations` 与 `go build ./cmd/server ./cmd/migrate` 通过。
- [ ] 根 `go test ./...` 仍被工作树既有 `server/tmp/mail-overlay` 不完整临时副本阻塞；主服务、命令和迁移包已单独全量通过。
- [x] Web `tsc --noEmit`、本功能定向 Biome 检查和覆盖率测试通过；覆盖率测试共 78 个文件、332 个用例。
- [ ] Web 全量 Biome 检查仍被工作树既有 66 个错误和 11 个警告阻塞，主要为未统一的 CRLF 格式；本次 4 个 Web 文件无诊断。
- [x] 迁移版本、文档链接和本次中文文件编码检查通过；`202608090002` 已在本地 PostgreSQL 应用并复查为 `applied`。
- [x] 使用当前 Chrome 登录会话完成真实路由、旧服务响应兼容、桌面与 390×844 响应式、模式切换及无横向溢出验收；未触发付费生成。
- [x] FFmpeg/FFprobe 8.1.1 已安装并完成可执行验证。
- [x] 真实 AMUX 提交及“开通后”二次复测均已到达 Provider；`premium/amux` 分组仍返回 `model_not_found`，只读模型目录也未暴露 Seedance 或其他常见视频模型。
- [x] 已确认 AMUX 失败根因：当前账户仍在 `default` 用户分组，充值后平台才会自动升级到可访问 `premium` 视频渠道的用户分组；不是模型 ID 或 Adapter 协议错误。
- [x] 动态表情模型选项与队列统一校验可运行视频协议；误配置为 `siliconflow` 的同名 Seedance 目录项不再进入前台或创建任务。
- [ ] 完成 AMUX 充值后，使用 `doubao-seedance-2.0-fast` 完成页面上传、刷新恢复、GIF/MP4 预览与下载验收。

## Task 6：生图默认、视频可选增强

- [x] 动态表情任务新增 `image/video` 生成方式，新任务默认 `image`，存量记录按 `video` 兼容。
- [x] 生图模式使用支持参考图的图片模型一次生成一组连贯帧，默认请求 6 帧，并用固定 FFmpeg 参数编码为 320×320 无限循环 GIF。
- [x] 火山 ARK 顺序组图与 OpenAI-compatible `n` 多图请求统一收敛到 Provider 图片 Adapter；模型目录只展示当前 Adapter 能处理参考图的模型。
- [x] Web 分开展示生图模型与视频模型，默认选择“生图 GIF”，视频增强作品继续额外保留 MP4。
- [x] `motion_sticker.generate` 工具新增可选 `mode`，未传时默认 `image`，页面、智能体与工作流继续复用同一持久任务服务。
- [x] 同步生图任务在服务中断后不自动重放付费请求，状态不确定时安全失败，避免重复计费。
- [x] 新增双模式迁移、服务端队列/运行时/Handler/工具测试和 Web API/页面测试。
- [ ] 使用一个已充值且支持多图输出的生图模型完成真实上传、离页恢复、GIF 预览与下载验收；该步骤会产生模型费用，不在自动验证中调用。

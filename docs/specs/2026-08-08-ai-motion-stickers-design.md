# AI 动态表情工作台设计

> 日期：2026-08-09
> 状态：双模式实现完成；真实 Seedream 生图已暴露角色漂移并完成首轮补强，生图与视频仍需人工复验
> 计划：`docs/plans/2026-08-08-ai-motion-stickers.md`

## 目标

为登录用户提供 owner 私有的动态表情生成能力：上传一张单角色动画参考图，输入角色动作，默认由生图模型生成一组连贯帧并编码为循环 GIF；需要更流畅动作时可切换视频模型生成 MP4，并派生 GIF。页面、智能体和工作流必须复用同一生成服务，不能各自直连 Provider。

## MVP 契约

- 新入口为 Web `/workbench/gifs`，生成记录默认仅当前用户可见。
- 输入为一张 JPG、PNG 或 WebP 参考图和一段动作描述；动作描述不作为画面文字。
- 参考图要求单角色、主体完整、轮廓清晰、背景简单；格式、大小和像素为硬校验，彩色角色的显著配色漂移在输出阶段保守拦截，单色角色仍视为语义校验不确定而放行。
- 未明确背景时使用简洁背景和完成动作所需的最少道具；用户明确背景时遵循描述。
- 默认使用支持 `image_generation + reference_image` 且 Adapter 支持多图输出的模型，一次请求默认生成 6 张动作阶段连续的独立画面；视频增强使用支持 `video_generation + reference_image` 的模型。
- 生图提示把图一设为唯一角色身份基准，动作中的人称代词不得创建新人物，并固定物种、主体外观、镜头、构图与背景，让末帧回到接近首帧的姿势；视频增强继续将同一参考图作为首尾参考。FFmpeg 负责固定尺寸、调色板和无限循环编码。
- 生图模式只保存最大 320×320 的循环 GIF；视频增强保存 720p MP4 母版并派生 GIF。
- 目标等待时间为 1–3 分钟；Provider 任务技术超时为 10 分钟。用户离开页面或服务重启后任务可恢复。
- 每个用户最多一个运行中任务。失败不自动重新调用付费模型；已生成 MP4 的转码失败只重试转码。

## 架构边界

### 模型目录

- 生图模式复用 `image_generation`、`reference_image` 与 `image_protocol`；视频增强复用 `video_generation` 与 `video_protocol`。
- `reference_image` 可同时服务静态生图和图生视频；动态表情选项按模式分别返回可由当前 Adapter 执行的图片模型与视频模型。
- 火山 ARK 图片 Adapter 用顺序组图参数请求连贯帧，OpenAI-compatible 图片 Adapter 用 `n` 请求多张结果；两者统一返回完整图片结果集。
- AMUX 默认视频协议为 `amux_video`，复用现有 `AMUX_API_KEY` 与带 `/v1` 的 `AMUX_BASE_URL`。
- 视频连接检测会产生真实费用，只允许管理员手动触发并明确提示。

### Provider 与任务

- Provider 中立图片接口负责组图生成，Provider 中立视频接口负责创建、查询和下载视频；AMUX Adapter 使用 `/video/generations`、`/video/generations/{task_id}` 与 `/videos/{task_id}/content`。当前 AMUX 文档未提供取消端点，因此首期不伪造上游取消能力。
- `ai_motion_sticker_generations` 独立于 `ai_image_generations`，记录 owner、生成方式、模型与协议快照、原始动作、编译提示词、参考图、帧数、Provider task ID、阶段、MP4/GIF 资产、用量与错误。存量记录默认解释为视频模式。
- 持久 worker 恢复 `queued/running` 任务；生图阶段为 `generating_frames/validating_identity/encoding_gif/completed`，视频阶段为 `submitting/generating/downloading/transcoding/completed`。
- 参考图和输出均进入 owner 私有对象路径；删除生成记录时清理对应对象。

### 调用方

- Web 创建任务后立即返回 generation，并通过详情轮询展示阶段。
- 智能体调用返回后台任务卡，不阻塞本轮对话。
- 工作流节点默认等待完成，输出 `generationId`、`generationMode`、可选 `mp4Url`、`gifUrl`、宽高和时长。
- 首版先交付共享服务、Web 与通用工具契约；智能体/工作流 UI 绑定在共享契约稳定后接入。

## 安全与失败边界

- 服务端强制 owner 查询、取消、删除和下载权限。
- 下载 Provider 图片或视频时限制响应大小和 MIME；视频额外限制时长和像素。FFmpeg 只读取服务端生成的临时帧清单或视频文件。
- FFmpeg 只接收服务端生成的临时文件路径和固定参数，不拼接用户命令。
- 上游错误进入安全错误码；API 和审计不保存参考图 Base64、签名 URL 或密钥。
- Provider 成功但转码失败时保留 MP4，允许无需模型费用的转码重试。
- 同步生图请求如果因服务中断而失去上游状态，不自动再次调用付费模型；任务安全失败并提示用户重新提交。
- 生图模型返回的彩色角色若与参考图显著配色漂移，任务以 `identity_mismatch` 失败并提示重试或切换模型；该本地检查只拦截明显换角，不把它表述为完整的语义身份识别。

## 验收

- 同一用户并发创建只有一个成功；不同用户互不影响。
- 刷新、离页和服务重启后任务状态可恢复。
- 生图成功任务提供可预览、下载的 GIF；视频增强成功任务同时提供 MP4 与 GIF。GIF 自动循环且首尾无明显硬切。
- 彩色参考角色不得被明显替换为其他人物或物种；检测到显著换角时不保存为成功作品。
- 删除记录会清理参考图、MP4 和 GIF；其他用户无法读取。
- AMUX 模型、Provider、用量、耗时和失败进入现有 AI 审计。

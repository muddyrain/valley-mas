# ARK Go 入口参考

## 当前主要 AI Handler

- `server/internal/handler/creator_ai_title.go`
- `server/internal/handler/creator_ai_tags.go`
- `server/internal/handler/resource_tag.go`

## 现有共享调用模式

- `server/internal/handler/resource_tag.go` 中的 `callChatStream(...)`
- 包级客户端复用：`sync.Once` + `*arkruntime.Client`

## 当前 ARK 环境变量

- `ARK_API_KEY`
- `ARK_BASE_URL`
- `ARK_VISION_MODEL`
- `ARK_TEXT_MODEL`

## 现有行为约定

- 模型字段使用 `ep-` 前缀做接入点 ID 校验。
- 缺配置返回 `503`。
- 上游 AI 请求失败返回 `502`。
- 图片输入支持 base64，并会规范成 data URL 格式。

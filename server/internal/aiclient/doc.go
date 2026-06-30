// Package aiclient 是 Valley MAS 服务端的通用 AI 基础客户端。
//
// 设计原则：
//
//   - 纯基础层：只 import 标准库、arkruntime SDK、第三方 HTTP/JSON 库与 internal/aiusage。
//     禁止 import internal/mindarena、internal/lifetrace、internal/handler、
//     internal/model、internal/database 等业务包，保持向上单向依赖。
//   - 不读取任何业务上下文，env 是唯一的运行时配置来源。
//   - 不做对外路由暴露，只提供函数 / 类型供上层 handler 与服务复用。
//
// 三 Provider 环境变量来源：
//
//   - ARK：ARK_API_KEY、ARK_BASE_URL（缺省 https://ark.cn-beijing.volces.com/api/v3）、
//     ARK_TEXT_MODEL、ARK_VISION_MODEL、ARK_IMAGE_MODEL、ARK_IMAGE_MODEL_FALLBACK。
//     模型字段必须使用以 "ep-" 开头的接入点 ID。
//   - OpenAI 兼容：通过 ReadOpenAIConfig(opts) 自定义 env 链，
//     典型：LIFE_TRACE_AI_* > OPENAI_API_*；缺省 base https://api.openai.com/v1。
//   - Gemini Vision：GEMINI_API_KEY、GEMINI_API_BASE_URL（缺省
//     https://generativelanguage.googleapis.com/v1beta）、GEMINI_VISION_MODEL
//     （缺省 gemini-2.5-flash）。
//
// 新增 AI 功能的接入入口：
//
//   - 文本：调用 ReadARKTextConfig 拿配置，再用 ARKClient(timeout) 取共享 client，
//     然后用 NewARKChatRequest 构造请求；流式响应用 NewSSEWriter 包装。
//   - 视觉：调用 ReadARKVisionConfig 或 ReadGeminiVisionConfig；图像数据先用
//     NormalizeImageInput 归一化。
//   - 输出：用 ExtractARKContent / ExtractARKMessageText 取文本内容，
//     用 ExtractJSONObject 抽取 JSON 主体，用 TrimRunes 控制长度。
//   - 用量：用 RecordCall 记录调用结果（自动从 context 拉 audit 上下文）。
package aiclient

# 工作流 HTTP 请求节点设计

## 目标

在 Graph v4 中新增可执行的 `http` 节点。用户可通过画布配置受控的 HTTP(S) 请求，并把响应正文、状态码和响应头作为下游变量使用。

## 配置契约

```json
{
  "method": "GET",
  "url": "https://api.example.com/items/{{start.output.id}}",
  "params": [{ "name": "page", "value": "1" }],
  "headers": [{ "name": "Accept", "value": "application/json" }],
  "bodyType": "none",
  "body": "",
  "timeoutSeconds": 30,
  "retryCount": 0,
  "ignoreError": false
}
```

- 首期方法：`GET`、`POST`、`PUT`、`PATCH`、`DELETE`。
- 请求参数、URL、请求头和 JSON 请求体允许引用上游变量。
- 固定输出：`body: string`、`statusCode: number`、`headers: object`。
- `ignoreError` 开启时，网络错误或非 2xx 响应改为节点成功，并在固定输出外返回 `error` 字段；未开启则按既有运行时失败链路处理。

## 安全边界

- 仅接受绝对 `http` / `https` URL；拒绝用户信息、重定向和未经白名单许可的非标准端口。仅在 `ENV=development` 时，允许通过 `WORKFLOW_HTTP_LOCAL_ALLOWLIST` 精确放行 `localhost` 或回环 IP 的端口；默认仅为当前服务端口放行 `localhost:<PORT>`，生产环境始终忽略该白名单。
- 解析域名后拒绝回环、私有、链路本地、组播、未指定与保留 IP；自定义 HTTP Transport 在连接时再次校验解析后的地址，避免 DNS 重绑定。
- 单次请求最大 60 秒、最多重试 3 次、响应正文最多 1 MiB；不透传服务端 Cookie 和认证信息。
- 首期没有密钥库、认证模板、文件上传、multipart 或 OAuth。敏感鉴权在专用凭据能力完成前不开放。

## 验收

1. 节点选择器可添加 HTTP 请求节点，画布卡片展示方法、URL 状态和三个固定输出。
2. 右侧面板可配置方法、URL、参数、请求头、请求体、超时、重试和异常忽略；可从简化 cURL 导入 `curl -X/-H/-d URL`。
3. 服务端拒绝 SSRF 地址、无效配置、非 2xx（未忽略）和超限响应；对允许的请求正确返回三个固定输出。
4. 下游节点可引用 `{{http.output.body}}`、`{{http.output.statusCode}}`、`{{http.output.headers}}`。

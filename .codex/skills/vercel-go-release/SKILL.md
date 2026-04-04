---
name: vercel-go-release
description: 面向 Vercel + Go server 一体部署安全交付 Valley MAS。适用于任何可能影响构建、路由、环境变量、Go 服务行为或前后端联动部署效果的改动。
---

# Vercel-Go 发布检查

只要本地改动在 Vercel 上可能表现不同，就使用这个技能。

## 默认前提

- 项目部署在 Vercel。
- 线上部署里包含 Go server。
- 一个改动要算完成，必须同时考虑前端和 Go 侧的上线影响。

## 规则

1. 前端改动如果依赖接口，要确认它在部署后的路由假设仍然成立。
2. Go 改动要按 Vercel 部署后的路由和鉴权去思考，不要只按本地 dev 想。
3. 校验优先跑最窄的：前端 TypeScript、Go build，再决定要不要扩大。
4. 最终说明里要主动点出环境变量、路由或平台假设。
5. 避免给出只在本地可行、但在 Vercel 路由或构建入口下会失效的方案。

## 校验捷径

- Web：`node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`
- Go：`cd server && go build ./cmd/server`，以及必要的其他入口
- 如果任务明显影响发布行为，最终说明里写清楚还需要一次真实的 Vercel 发布验证。

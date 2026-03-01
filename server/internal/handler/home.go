package handler

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

// HomePage 服务入口页（浏览器访问友好）
func HomePage(c *gin.Context) {
	now := time.Now().Format("2006-01-02 15:04:05")
	html := fmt.Sprintf(`<!doctype html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Valley MAS Server</title>
	<style>
		:root {
			color-scheme: light dark;
			--bg: #0b1020;
			--card: #121a33;
			--text: #e8ecff;
			--muted: #9fb0e0;
			--ok: #41d1a3;
			--line: #2b3761;
			--link: #7cb4ff;
		}
		* { box-sizing: border-box; }
		body {
			margin: 0;
			min-height: 100vh;
			font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;
			background: radial-gradient(1200px 600px at 20%% 0%%, #1b2a57 0%%, var(--bg) 60%%);
			color: var(--text);
			display: grid;
			place-items: center;
			padding: 24px;
		}
		.card {
			width: min(780px, 100%%);
			background: color-mix(in oklab, var(--card) 88%%, black);
			border: 1px solid var(--line);
			border-radius: 16px;
			padding: 24px;
			box-shadow: 0 12px 40px rgba(0,0,0,.35);
		}
		h1 { margin: 0 0 8px; font-size: 28px; }
		p { margin: 8px 0; color: var(--muted); line-height: 1.7; }
		.ok {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			color: var(--ok);
			font-weight: 600;
			margin: 6px 0 16px;
		}
		.dot {
			width: 10px;
			height: 10px;
			border-radius: 999px;
			background: var(--ok);
			box-shadow: 0 0 0 6px rgba(65,209,163,.2);
		}
		.list {
			margin-top: 16px;
			border: 1px solid var(--line);
			border-radius: 12px;
			overflow: hidden;
		}
		.row {
			display: grid;
			grid-template-columns: 220px 1fr;
			gap: 12px;
			padding: 10px 14px;
			border-bottom: 1px solid var(--line);
		}
		.row:last-child { border-bottom: none; }
		code, a {
			color: var(--link);
			text-decoration: none;
			word-break: break-all;
		}
		.footer { margin-top: 14px; font-size: 12px; color: #7e8db6; }
	</style>
</head>
<body>
	<main class="card">
		<h1>Valley MAS Go 服务</h1>
		<div class="ok"><span class="dot"></span>服务运行中</div>
		<p>这是后端入口页（浏览器友好模式）。如果你熟悉 Node.js，可以把它理解为 Express 的 <code>GET /</code> 欢迎路由。</p>
		<div class="list">
			<div class="row"><strong>健康检查</strong><span><a href="/health">GET /health</a></span></div>
			<div class="row"><strong>验证口令</strong><span><code>POST /api/v1/code/verify</code></span></div>
			<div class="row"><strong>创作者资源</strong><span><code>GET /api/v1/creator/:code/resources</code></span></div>
			<div class="row"><strong>管理后台</strong><span><code>/api/v1/admin/*</code></span></div>
		</div>
		<p class="footer">当前时间：%s</p>
	</main>
</body>
</html>`, now)

	c.Data(200, "text/html; charset=utf-8", []byte(html))
}

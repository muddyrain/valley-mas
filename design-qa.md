# 智能体对话页设计 QA

## 比较目标

- Source visual truth: `C:\Users\A\.codex\generated_images\019f9a2c-da64-7a12-87f1-dd4308ac0853\exec-c6c4e69a-afc7-4ff0-82dc-8b1978ff3c03.png`
- Implementation route: `http://127.0.0.1:5174/workbench/apps/preview`
- Intended viewport: desktop 1536 × 1152, light mode, 通用智能体新会话状态，配置抽屉打开。
- Implementation screenshot: unavailable. The route redirected to the login screen because the in-app browser has no authenticated session.

## 可核对的实现范围

- 通用智能体对话工作台：扩宽会话侧栏、强化活动会话状态、新会话引导与聚焦输入框。
- 交互层：会话下拉菜单、三段式配置 Sheet、发布确认 Dialog、窄屏底部 Drawer。
- 视觉基线：沿用项目 shadcn token、语义蓝主动作、无渐变与无专属壁纸生成功能。

## Required Fidelity Surfaces

- Fonts and typography: 未能以浏览器渲染图核对；实现沿用项目字体与既有 shadcn 字号/字重。
- Spacing and layout rhythm: 未能以浏览器渲染图核对；代码按目标使用 17rem 会话轨、最大 3xl 输入区和语义间距。
- Colors and visual tokens: 已静态核对，使用 `background`、`muted`、`border`、`primary` 等现有 token。
- Image quality and asset fidelity: 智能体头像沿用已有 `AgentAvatar` 实际资源；未新增图像资产。
- Copy and content: 已静态核对，界面文案均为通用智能体任务、会话和配置语境。

## Findings

- [P1] 运行时设计比对被登录守卫阻断。
  Location: `/workbench/apps/preview`。
  Evidence: 应用内浏览器在该路由被重定向到登录页；无控制台错误。
  Impact: 无法捕获与目标图同状态的实现截图，也无法验证 Sheet、Dialog、Drawer 的实际开关和响应式布局。
  Fix: 在已登录的本地会话打开任意智能体路由后，按相同桌面与窄屏视口重新捕获并对照。

## Open Questions

- 暂无。验证只缺少已登录会话，不需要改变产品范围或鉴权边界。

## Implementation Checklist

1. 在已登录会话中打开任意通用智能体。
2. 验证会话菜单、配置 Tab、发布确认和窄屏操作 Drawer。
3. 截图与源视觉同屏对照，补充本报告的实现截图路径与最终结论。

## Follow-up Polish

- [P3] 根据真实对话内容长度，微调侧栏标题截断和空状态纵向留白。

final result: blocked

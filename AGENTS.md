# Valley MAS AI 协作约定

本文件用于统一本仓库的 AI 协作行为，减少“同类任务反复对齐”的成本。

## 通用要求

- 默认使用中文沟通与输出。
- 开始执行前先判断本次应启用的 skills。
- 回答中明确说明“本次使用了哪些 skills，以及原因”。
- 优先复用现有实现，不随意新建并行方案。

## 项目必读 Skills（默认优先）

- `valley-mas-guide`
- `task-completion-guard`
- `encoding-guard`
- `skill-usage-disclosure`
- `component-reuse-guard`
- `change-log-guard`

## 场景强制 Skills

- 产品行为与用户链路改动：`valley-mas-product-guard`
- 博客/资源访问控制改动：`blog-resource-access-guard`
- 创作空间与工作台改动：`creator-space-ux`
- Web 主题与视觉一致性：`web-theme-consistency`、`brand-theme-guard`
- 卡片结构与参数区改动：`card-system-consistency`
- 组件复用与重复逻辑收敛：`component-reuse-guard`
- 中文产品文案：`product-copy-cn`、`public-copy-boundary`
- 任何生成 commit message、执行 `git commit`、或用户说“提交”“提交吧”“提交代码”“帮我提交”：`conventional-commit-guard`
- Go + Vercel 发布链路：`vercel-go-release`
- Go 调用火山 ARK 的 AI 能力：`ai-capability-orchestration`
- Web 持续迭代任务管理：`web-feature-iteration`
- Web 更新日志发布（仅 commit/push 节点记录）：`web-update-log-guard`
- Web 列表页 keyword/page URL 联动：`web-url-state-sync`
- climber-game 持续迭代任务管理：`climber-game-iteration`
- climber-game 关卡与目标职责改动：`climber-game-design-guard`
- Unity Climber 项目迭代与 Three.js 过渡：`unity-climber-iteration`
- 任何真实文件改动后的日志沉淀：`change-log-guard`
- 技能沉淀与更新：`skill-opportunity-scout`、`skill-sync-guard`、`skill-category-guard`

## 最低校验要求

- 修改 Go 服务后：运行 `cd server && go test ./...`
- 修改 web 端后：运行 `pnpm --filter web exec tsc --noEmit`
- 修改 admin 端后：运行 `pnpm --filter admin exec tsc --noEmit`
- 涉及中文文案改动后：运行 `python .codex/skills/encoding-guard/scripts/check_mojibake.py`

## 变更约束

- 不在源码、文档、示例配置中写入真实密钥。
- 涉及新环境变量时，同步更新示例配置与说明。
- 发现现有逻辑可复用时，优先抽取共享实现，避免继续复制粘贴。
- 只要进入提交阶段，必须先启用 `conventional-commit-guard`，先查看最近 5 条提交风格，再生成提交信息。
- 若用户只说“提交/提交吧/提交代码”，默认提交信息必须使用一行简短中文 Conventional Commit，不得自动扩写长正文。
- 若本轮是 Web 改动且准备 `commit/push`，除 `conventional-commit-guard` 外还需联动 `web-update-log-guard`。

## 对外文案边界（新增）

- 严禁将用户提示词、内部指令、实现思路、推理过程原文直接展示在页面 UI。
- 页面中的文案必须是面向终端用户的产品表达，不得出现“提示词感”“协作指令感”文案。
- 若用户要求的是视觉效果升级，默认输出为产品文案与界面信息，不回显用户原始要求句式。

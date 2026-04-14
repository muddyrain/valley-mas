# Skills 中文速查表

这份索引不是单纯的目录列表，而是"什么时候该触发哪个 skill"的中文速查表。

建议保持 `.codex/skills/` 目录平铺，不要为了分类把 skill 真正移到多层子目录里。

原因：

- 当前 skill 发现机制更适合平铺目录
- 目录名稳定更利于长期触发
- 分类和触发建议可以通过索引文档完成，不必牺牲可发现性

## 先看这一段

拿不准该用哪个 skill 时，先按这个顺序判断：

1. 这是"项目定位 / 找入口"问题，还是"具体功能开发"问题？
2. 这是"产品行为"问题，还是"组件实现"问题？
3. 这是"创作者工作台"问题，还是"公开展示页"问题？
4. 这是"中文文案"问题，还是"发布 / 部署"问题？
5. 这次改动会不会让已有 skill 过期？

如果还是不确定，默认优先看：

- [valley-mas-guide](./valley-mas-guide/SKILL.md)
- [valley-mas-product-guard](./valley-mas-product-guard/SKILL.md)

## 一、项目总览与入口判断

### `valley-mas-guide`

文件：
- [valley-mas-guide](./valley-mas-guide/SKILL.md)

什么时候触发：
- 你还没判断清楚这次任务该进 `apps/web`、`server`、`apps/admin` 还是别的目录
- 需要先确认项目结构、模块边界、常用校验命令
- 跨前后端改动，怕一开始就找错入口

不适合什么时候用：
- 你已经非常明确只改某个具体页面或组件

典型触发语：
- "这个需求在仓库里该改哪？"
- "这个项目这块逻辑是在前端还是 Go 后端？"

### `valley-mas-product-guard`

文件：
- [valley-mas-product-guard](./valley-mas-product-guard/SKILL.md)

什么时候触发：
- 改动会影响真实产品行为
- 涉及创作空间、博客、资源、图文、返回路径、状态、可见范围
- 不只是"代码能跑"，而是"体验不能退化"

不适合什么时候用：
- 纯样式微调且不影响行为
- 单纯重构不改变产品结果

典型触发语：
- "这个改动会不会把原来的用户链路弄坏？"
- "帮我做功能，但别把体验改崩。"

## 二、图文与内容创作

### `image-text-studio`

文件：
- [image-text-studio](./image-text-studio/SKILL.md)

什么时候触发：
- 图文编辑页
- 手动分页
- 高亮、局部字号、贴纸、模板
- 编辑预览和最终生成图一致性
- 图文卡片、图文详情、图文导出

不适合什么时候用：
- 纯博客编辑
- 普通资源卡片，不涉及图文生成链路

典型触发语：
- "图文编辑这里再改一下"
- "为什么编辑页预览和最后生成图不一样"
- "图文卡片不要再用假的预览了"

### `product-copy-cn`

文件：
- [product-copy-cn](./product-copy-cn/SKILL.md)

什么时候触发：
- 改中文按钮文案
- 改辅助说明、空状态、状态标签
- 你明确要求"更像产品，不要像 AI 在说话"
- 页面定位变了，需要重写介绍文案

不适合什么时候用：
- 纯接口、纯逻辑、纯样式任务

典型触发语：
- "这个文案改一下"
- "不要这么平台化"
- "这句介绍不像我的产品"

## 三、创作者工作台与访问链路

### `creator-space-ux`

文件：
- [creator-space-ux](./creator-space-ux/SKILL.md)

什么时候触发：
- `MySpace` 改动
- 创作者管理态卡片
- 编辑、删除、状态标签、管理按钮
- 创作者从自己的空间进入详情页
- 返回路径要保留上下文

不适合什么时候用：
- 完全公开的博客列表页或资源列表页

典型触发语：
- "创作空间这里再优化一下"
- "管理态和公开态不要一样"
- "从我的空间点进去返回不对"

### `blog-resource-access-guard`

文件：
- [blog-resource-access-guard](./blog-resource-access-guard/SKILL.md)

什么时候触发：
- 私密博客 / 私密资源访问
- 公共接口与管理接口的兜底
- 作者本人访问自己的私密内容
- 404、权限、返回路径混在一起的 bug

不适合什么时候用：
- 纯视觉改动
- 与访问权限无关的静态内容修改

典型触发语：
- "作者自己访问私密内容变 404 了"
- "资源详情返回页错了"
- "公共接口拿不到，但作者应该能看"

## 四、组件与展示系统

### `card-system-consistency`

文件：
- [card-system-consistency](./card-system-consistency/SKILL.md)

什么时候触发：
- 博客卡片、图文卡片、资源卡片
- 卡片的预览区、参数区、状态区、按钮区
- 想抽公共组件，但又担心三种内容类型被硬统一
- 卡片内展示是否真实、是否误导用户

不适合什么时候用：
- 与卡片无关的详情页纯内容区

典型触发语：
- "这几个卡片样式不统一"
- "要不要抽成组件"
- "这个卡片预览太假了"

### `component-reuse-guard`

文件：
- [component-reuse-guard](./component-reuse-guard/SKILL.md)

什么时候触发：
- 同一段 JSX 弹窗 / 表单 / 卡片在两处以上重复出现
- 同一批 state + handler 被复制粘贴到多个文件
- 用户说"每个地方都要写一遍"、"维护成本太大"
- 新建页面时发现已有相似功能可抽取

不适合什么时候用：
- 只在一处出现且未来极不可能复用的代码
- 两处看起来像但交互本质不同，强行统一会引入过多 props

典型触发语：
- "这个要封装成公用组件"
- "每个地方都要写一遍太奇怪了"
- "维护成本很大"
- "能复用就复用"

## 五、发布与工程交付

### `vercel-go-release`

文件：
- [vercel-go-release](./vercel-go-release/SKILL.md)

什么时候触发：
- 改动可能影响 Vercel 发布
- 改了 Go 路由、接口、可选鉴权、部署相关行为
- 前端改动依赖后端接口，担心线上和本地不一致
- 你想确认"这改完在 Vercel 上会不会出问题"

不适合什么时候用：
- 完全本地、纯静态、和部署无关的小样式改动

典型触发语：
- "这个会不会影响线上"
- "Vercel 上是不是也要注意这个"
- "我这边发布是 Vercel，而且带 Go server"

### `encoding-guard`

文件：
- [encoding-guard](./encoding-guard/SKILL.md)

什么时候触发：
- 改中文文案
- 改文本密集页面
- 担心乱码
- 担心中文被写成 `?`

不适合什么时候用：
- 完全不涉及文本的纯逻辑改动

典型触发语：
- "中文文案别再坏了"
- "顺手检查一下有没有乱码"

### `conventional-commit-guard`

文件：
- [conventional-commit-guard](./conventional-commit-guard/SKILL.md)

什么时候触发：
- 需要帮你写 commit message
- 想确认这次提交该用 `feat`、`fix`、`chore`、`docs` 哪一种
- 想统一整个项目的 commit 风格

不适合什么时候用：
- 这次根本不涉及 git 提交信息

典型触发语：
- "帮我写个 commit message"
- "这个提交应该用 feat 还是 fix"
- "按 git 标准来写"

## 六、技能体系自身

### `skill-sync-guard`

文件：
- [skill-sync-guard](./skill-sync-guard/SKILL.md)

什么时候触发：
- 这次功能规则已经变了
- 页面定位已经变了
- 组件职责已经变了
- 发布方式、回跳逻辑、卡片展示逻辑已经更新
- 你怀疑已有 skill 已经过期

不适合什么时候用：
- 一次性小修，不影响长期规则

典型触发语：
- "这个功能都变了，skill 也要跟着改"
- "别只改代码不改 skill"

### `skill-usage-disclosure`

文件：
- [skill-usage-disclosure](./skill-usage-disclosure/SKILL.md)

什么时候触发：
- 只要本回合用了任意 skill

不适合什么时候用：
- 这次根本没触发 skill

典型触发语：
- "你要告诉我你用了哪些 skills"

### `skill-opportunity-scout`

文件：
- [skill-opportunity-scout](./skill-opportunity-scout/SKILL.md)

什么时候触发：
- 某类规则已经反复出现
- 某个固定流程改了很多轮
- 你开始觉得"这玩意以后肯定还会反复改"
- 某种产品心智已经稳定成型

不适合什么时候用：
- 一次性临时任务
- 还在快速摇摆、没有稳定结论的探索

典型触发语：
- "这个是不是也可以抽成一个 skill"
- "以后这种改动 AI 应该默认知道"

### `task-completion-guard`

文件：
- [task-completion-guard](./task-completion-guard/SKILL.md)

什么时候触发：
- 任务先有 task list，再要继续落实
- 用户说"继续吧""直接改吧""帮我更新吧"
- 任务包含分析、实施、验证、收尾多个阶段
- 你担心自己会停在规划、口头承诺或部分执行
- 需要明确判断"这次到底是真的做完了，还是只做了一部分"

不适合什么时候用：
- 用户明确只要一个方案、一个脑暴结果或一个 task list
- 本次任务纯问答，没有实际执行动作

典型触发语：
- "继续吧"
- "你先排个 task list 然后更新吧"
- "帮我看看这项任务是不是已经真正做完了"
- "别只说在做，确认下有没有真的执行"

### `public-copy-boundary`

文件：
- [public-copy-boundary](./public-copy-boundary/SKILL.md)

什么时候触发：
- 改首页、栏目说明、空状态、辅助文案
- 用户明确说"不要把这些内部指引写给用户看"
- 你在写文案时出现了"更舒服、更适合、更好看"这类设计推理句式
- 文案里混入了本来只该对开发者或 AI 说的话

不适合什么时候用：
- 纯内部文档、任务拆解、协作说明
- 纯逻辑改动，没有用户可见文案

典型触发语：
- "这个只是给你的改动指引，不要展示给用户"
- "项目里不要出现这种解释型字样"
- "不要把设计推理写到页面上"

## 常见组合

### 改图文编辑页

优先触发：
- [image-text-studio](./image-text-studio/SKILL.md)
- [product-copy-cn](./product-copy-cn/SKILL.md)
- [encoding-guard](./encoding-guard/SKILL.md)

如果这次改动会重定义图文规则，再补：
- [skill-sync-guard](./skill-sync-guard/SKILL.md)

### 改创作空间卡片

优先触发：
- [creator-space-ux](./creator-space-ux/SKILL.md)
- [card-system-consistency](./card-system-consistency/SKILL.md)

如果涉及访问或回跳异常，再补：
- [blog-resource-access-guard](./blog-resource-access-guard/SKILL.md)

### 改首页介绍、按钮文案、README

优先触发：
- [product-copy-cn](./product-copy-cn/SKILL.md)
- [encoding-guard](./encoding-guard/SKILL.md)

如果站点定位都变了，再补：
- [skill-sync-guard](./skill-sync-guard/SKILL.md)

### 改权限、404、自访问逻辑

优先触发：
- [blog-resource-access-guard](./blog-resource-access-guard/SKILL.md)
- [valley-mas-product-guard](./valley-mas-product-guard/SKILL.md)

如果涉及 Go 路由或部署后行为，再补：
- [vercel-go-release](./vercel-go-release/SKILL.md)

### 改部署、路由、Go server

优先触发：
- [vercel-go-release](./vercel-go-release/SKILL.md)
- [valley-mas-guide](./valley-mas-guide/SKILL.md)

### 改 climber-game 关卡、手感或职责边界

优先触发：
- [climber-game-design-guard](./climber-game-design-guard/SKILL.md)
- [web-feature-iteration](./web-feature-iteration/SKILL.md)

如果涉及产品行为一致性，再补：
- [valley-mas-product-guard](./valley-mas-product-guard/SKILL.md)

### 准备提交代码

优先触发：
- [conventional-commit-guard](./conventional-commit-guard/SKILL.md)

如果本次还改了中文文档或站点介绍，再补：
- [product-copy-cn](./product-copy-cn/SKILL.md)

## 使用建议

1. 每次优先触发最关键的 1 到 3 个 skill，不要贪多。
2. 功能改完后，顺手想一下这次有没有把某个 skill 的前提改掉。
3. 如果触发了 skill，按 [skill-usage-disclosure](./skill-usage-disclosure/SKILL.md) 主动告诉用户。
4. 如果某类规则已经稳定出现多次，按 [skill-opportunity-scout](./skill-opportunity-scout/SKILL.md) 评估是否该新增 skill。
5. 如果任务包含"计划 + 实施 + 校验"多阶段，按 [task-completion-guard](./task-completion-guard/SKILL.md) 自检是否真的已执行、已完成。
6. 如果改的是用户可见文案，按 [public-copy-boundary](./public-copy-boundary/SKILL.md) 检查有没有把内部设计理由写进页面。

## 七、视觉与品牌

### `brand-theme-guard`

文件：
- [brand-theme-guard](./brand-theme-guard/SKILL.md)

什么时候触发：
- 改动影响全站可感知的视觉主题
- 头部导航、主按钮、品牌色、页面大容器需要统一
- 新页面已采用暖金主题，但旧入口还是紫色
- 怀疑"页面主体和头部像两套设计语言"

不适合什么时候用：
- 纯逻辑改动
- 单个图标微调
- 与全站主题无关的局部组件修复

典型触发语：
- "这几个页面主题不统一"
- "头部和主体颜色对不上"
- "紫色不要再主导整站了"
- "新页面要跟上暖金主题"

## 八、climber-game 专项

### `climber-game-design-guard`

文件：
- [climber-game-design-guard](./climber-game-design-guard/SKILL.md)

什么时候触发：
- 调整 `packages/climber-game` 的关卡路线、障碍机制、相机或角色手感
- 讨论或修改 climber-game 的目标职责与产品边界
- 改 HUD、暂停菜单、游戏内角色切换等玩法内交互
- 改碰撞、斜坡、可达性回归与视觉-物理贴合策略

不适合什么时候用：
- 与 climber-game 无关的普通 Web 页面需求
- 只改文档排版且不涉及玩法或职责边界

典型触发语：
- "这个 climber-game 后续该怎么收口"
- "关卡这里再加一段高难挑战"
- "这个需求会不会让游戏定位跑偏"

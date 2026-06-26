# Desktop OS · 视觉风格设计

本文件是 Desktop OS(macOS Plush)的视觉风格唯一事实来源。
窗口结构、运行时治理和验收标准仍以 `apps/desktop-os/docs/PLAN.md` 为准;协作规则继承根目录 `AGENTS.md` 与 `apps/desktop-os/AGENTS.md`。
风格描述出现冲突时,以本文件为准。

## 一句话总纲

**任天堂 first-party 气质的桌面壳层。** 主基调沿用 Animal Crossing 的 storybook miniature(圆润、柔和、低饱和、长投影);系统级控件参考 Nintendo Switch 系统 UI 的安静质感(干净 list、明确选中态、底部 hint 条、tip 风格反馈);角色化、加载、徽章、装饰与点缀使用宝可梦风格的画面语言。
**不是真实毛毡摄影,不是 SaaS 扁平,不是 macOS Big Sur 仿写。**

## 三层结构

为了让"动森 + Switch + 宝可梦"三种语言不互相打架,统一用以下分层来分配它们的职责:

| 层 | 主导风格 | 典型场景 | 关键约束 |
|---|---|---|---|
| Scene 层(壁纸 / 桌面 / 大空间) | 动森 storybook miniature | 桌面壁纸、Music 沉浸态、毛绒花园、Launchpad 背景层 | 圆润远山、柔光、低饱和绿/天/沙;不出现现实摄影、写实材质、强透视。 |
| System 层(壳层、菜单、表单、控件) | Switch 系统 UI 质感 | MenuBar、Dock、Launchpad、Spotlight、Control Center、Notification Center、Window、Plush 控件 | 干净 list / card,明确 hover / 选中,底部 hint 行,tip 风格 toast;按钮形状仍是 Plush 圆角,不出现 Big Sur 的玻璃质感或 SaaS 扁平。 |
| Identity 层(头像、徽章、装饰、加载) | 宝可梦画风元素 | AI Command Center 智能体头像、通知中心装饰、Mini Apps 角色化插画、加载/空态吉祥物、能量 accent | 厚黑边 anime-cel 轮廓 + 高饱和能量色,只在"角色 / 装饰 / 状态反馈"出现,不蔓延到系统控件。 |

> 边界:Identity 层风格不能侵入 System 层。也就是说,按钮、输入框、菜单不可以套黑边漫画轮廓;系统控件永远是 Plush。

## 色彩

### 基础色板(沿用)

来自 `apps/desktop-os/AGENTS.md`,继续作为 Scene 与 System 层底色:

- cream `#f8f5ec`、sage `#8fb45e`、sky `#a8d4ea`、terracotta `#d97a4f`、butter `#f4d97a`、pink `#f4a8b8`。

### 能量 accent(宝可梦点缀)

只允许在 Identity 层 + 状态反馈 + 强动作按钮(危险操作除外)中出现,不进入大面积底色:

- ember `#ff7a4a`(火属性 / 危险态以外的"鼓励性强调")
- sunny `#f5c542`(电系黄 / 提示亮点)
- lagoon `#3aa6c9`(水系青 / 信息态)
- meadow `#5fbf6a`(草系绿 / 成功态)
- petal `#f48fb6`(妖精粉 / 心跳与情绪反馈)

### 使用规则

- 同一屏幕能量色不超过 1 个主导 + 1 个次要;不允许同时使用 ember/sunny/petal 做主色。
- 危险操作仍以 terracotta 偏暖红为底,不要用 ember 替代,以免与"激励/能量"语义混淆。
- 所有阴影一律柔和、低饱和、长投影,投影色相向冷蓝偏移,不用纯黑。

## 形状与尺度

- 基本圆角:控件 12-16,卡片 16-20,窗口 20-24;不出现尖角或 4 以下小圆角。
- 按钮高度统一 `--plush-control-h`(由 token 定义);不允许某个 App 单独把按钮压扁或拉高。
- 高度差和体积感来自长阴影 + 顶部 1px 高光 + 底部 1px 暗边,不用 box-shadow 堆出"玻璃 / 金属"。
- 卡片不打默认 1px 边框;改用 surface tone + 阴影分层。
- icon 优先 `lucide-react`;若需要 mascot/吉祥物,在 Identity 层使用 SVG 角色化插画或 Emoji,不混塞到 lucide 行列里。

## 字体与文案语言

- 字体:沿用现有 token,不新增字体文件;系统控件保持安静、字号克制。
- 标题层级遵循 PLAN 已落地的"标题/摘要/元信息"三层结构,不堆叠 tag。
- 文案语言参考 Switch 系统 UI:用户视角、短句、动词起手("打开"、"再试一次"、"切换城市"),避免开发者元说明("此入口已被整理到..."、"该模块依赖...")。
- 状态反馈尽量使用具体文案 + 一个轻量 emoji 或 mascot,不用工程化错误码。

## 动效

- 主基调:Plush 的弹性曲线 + 短时长(120-220ms),关键过渡用 motion 接管。
- Switch 借鉴:列表/卡片选中时的"轻微抬起 + 边缘高光",而不是颜色填满。
- 宝可梦借鉴:状态反馈类(签到、获得、解锁、加载完成)允许出现一次"星点弹跳 / 光圈呼吸",**仅限 Identity 层**,不放进系统按钮。
- `prefers-reduced-motion` 必须有兜底:取消弹跳、缩短至 0-80ms,但视觉层级仍可读。

## 各场景具体指引

### 桌面与壁纸(Scene 层)
- 默认壁纸保持动森式柔和远景:天空、远山、田野;允许季节切换。
- 不放写实风景照、不放赛博城市,不出现强透视或剪影都市天际线。

### MenuBar / Dock / Window / Launchpad / Spotlight / Control Center / Notification Center(System 层)
- 视觉走 Switch 系统 UI:干净底色、清晰分组、明确 hover/active、底部 hint 行(可选);拒绝 Big Sur 玻璃感与 SaaS 通用 dropdown。
- 选中态用"轻微抬起 + 高光",不大面积填色。
- 列表分割使用透明分隔线 + spacing,不用实色 1px 横线打断节奏。
- 滚动条统一接入 `PlushScrollbar`,空闲隐藏、滚动显示轻量 overlay thumb。

### Plush 控件(System 层)
- 所有 shadcn/base-ui 源码组件必须经 `PlushPrimitives` 包装层后再进入页面;直接暴露默认 SaaS 视觉视为违规。
- 公共控件清单见 `apps/desktop-os/AGENTS.md`「设计系统约束」章节。
- 危险按钮以暖红 + 二次确认为主,不用宝可梦 ember。

### AI Command Center(Identity 层重点)
- 头像 v1 仍走 `avatarColor + avatarIcon` CSS/Emoji 方案;升级头像资产时方向是"宝可梦动画品图鉴风":头肩比例、厚黑边轮廓、单色腮红、二段塞璐璐着色。
- 智能体卡片可以引入轻量 type-tag(类似宝可梦属性标签),但 type-tag 形状仍是 Plush 圆角,不照抄宝可梦官网圆形 type 章。

### Mini Apps(Scene + Identity 混用)
- 毛绒花园、云朵弹跳、色珠整理保持 Scene 层动森调性。
- 经典小游戏(方块下落、贪吃蛇、骰盅)允许在 UI 边角加入宝可梦风装饰元素(星点、心、能量光圈),但棋盘本体保持 Plush。

### 通知中心 / 加载 / 空态(Identity 层)
- 加载与空态优先用 `PlushLoading` / `EmptyState`;空态文案旁可以放一个角色化吉祥物。
- 吉祥物保持厚黑边 anime-cel 风,体积小、表情克制,不抢交互焦点。

## 边界与禁区

为了避免风格漂移,以下做法明确禁止:

- **真实毛毡摄影、绒毛照片素材、写实纹理 PBR**——本项目从未走过这条线。
- **macOS Big Sur 玻璃效果 / 高斯模糊背景填充**——保留 Plush 的实色 surface,不堆 frosted glass。
- **通用 SaaS 扁平 dashboard**——拒绝 1px hairline 边框、纯白底卡片、统一 6px 圆角。
- **直接搬运任天堂 / 宝可梦 / 动森 IP 角色形象、版权字体或商标元素**——仅借鉴**画面语言**。
- **Identity 层风格污染 System 层**——按钮 / 输入 / 菜单永远是 Plush,不戴黑边漫画框。
- **同屏多个高饱和能量色叠加做底色**——能量色只点缀。

## 演进与同步

- 风格描述发生变化时先改本文件,再去 `apps/desktop-os/docs/PLAN.md` 同步对应能力描述。
- `apps/desktop-os/AGENTS.md` 只保留"视觉风格 → 详见 docs/DESIGN.md"的指针,不再独立维护色卡。
- 引入新一类视觉资产(吉祥物、装饰插画、季节皮肤等)时,先在本文件追加该资产所属层(Scene / System / Identity)和使用边界,再落代码。

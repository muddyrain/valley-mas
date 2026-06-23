# Desktop OS 计划

## 当前状态

- 视觉风格唯一事实来源已落到 `apps/desktop-os/docs/DESIGN.md`：以任天堂 first-party 气质统领,动森 storybook miniature 打底、Switch 系统 UI 质感作壳层、宝可梦画风元素作 Identity 层点缀,色板增加 ember/sunny/lagoon/meadow/petal 能量 accent;`apps/desktop-os/AGENTS.md` 的视觉风格章节改为指向 DESIGN.md 的指针。
- macOS Plush 桌面壳层已包含壁纸、菜单栏、Dock、窗口管理、Spotlight、控制中心、通知中心、Launchpad 和多个内置 App。
- Launchpad v1 已接入 Dock 和菜单栏，并升级为 macOS 式覆盖层：支持关闭按钮、搜索、左右分页、分页指示点、按住横向拖拽翻页、打开 App 后自动关闭，以及基于 Motion 的打开/关闭和翻页动画。
- Finder 定位为 Valley 资源库外壳，接入公开资源列表、搜索、筛选、排序、收藏、下载、图片预览、右键菜单、最近浏览、下载记录和路径级视图状态记忆；资源卡片默认以完整缩略图、标题和来源为主，选中态只做高亮，快捷操作只在 hover 或 focus-within 时显示。
- Desktop OS 已新增公共 `PlushLoading` 和 `PlushLoadMore` 加载组件，Finder Quick Look、Finder 资源加载、Finder 加载更多、Safari 起始页资源加载和 Notes 同步加载统一使用毛绒风加载态。
- Desktop OS 已新增公共 `PlushImage` 图片组件，Finder 资源缩略图、详情预览和 Quick Look 使用统一图片加载失败兜底与单图重试。
- Desktop OS 已新增公共 `PlushSelect` 下拉组件，Finder、Calendar、Converter、Daily Tools 和 Dev Tools 的下拉菜单统一使用毛绒风控件，不再显示浏览器默认菜单。
- Desktop OS 已新增公共 `PlushScrollbar` 滚动容器：以 `overlayscrollbars` / `overlayscrollbars-react` 作为滚动交互底座，统一隐藏 Windows/Chromium 原生滚动条控件残影，空闲时隐藏滚动条、滚动中显示 storybook miniature 风格 overlay thumb；窗口内容区、Finder 侧栏/资源区/详情区、Blog 列表与正文、Notes 便签列表、Calendar 侧栏面板、通知中心面板已接入。Music 队列空态 `music-window__queue-empty`、歌词空态 `music-window__lyric-empty`、Mail 未登录占位 `mail-window__empty` 等迁移后不再被引用的私有 CSS class 已统一删除。
- Desktop OS 公共按钮 `PlushButton` 已支持 `loading` / `loadingLabel` / `unstyled` 属性：开启后自动 `aria-busy`、禁用点击、并展示毛绒风三连点动画；`unstyled` 模式让外部 className 主导视觉，便于沿用各 App 私有按钮样式时仍复用统一 loading 行为。Account App 的登录、保存资料、绑定 Gmail、绑定 QQ 邮箱、解绑邮箱按钮，Blog App 的刷新按钮，Weather App 的刷新按钮已全部接入，不再各自维护「保存中/登录中/绑定中/刷新中/更新中」三元文案与 disabled 互斥。
- Desktop OS 公共 `EmptyState` 已新增 `action` 槽：在空态/错误态右侧承载「重试 / 新窗口打开 / 重新定位」等操作按钮，`tone="danger"` 自动带上 `role="alert"`，让公共组件同时覆盖 empty 与 error status 视觉。Music App 队列与歌词空态、Safari iframe 嵌入受限提示与载入态、Mail App 列表加载/空邮件/未选择邮件已全部接入公共 `EmptyState` / `PlushLoading`，不再各自维护一次性的 `__empty` div + 自造按钮。
- Desktop OS 公共 `PlushConfirmDialog` 已封装：基于 `PlushDialog` 的标题 + 描述 + 取消/确认双按钮模板，支持 `tone="danger"` 高亮、`loading` 受控异步与禁止 backdrop 关闭、确认按钮内置 `PlushButton.loading` 三连点动画。Finder 删除资源包、Finder 删除保存搜索、Account 退出登录、Account 解绑邮箱、Mail 侧栏解绑邮箱、Notes 删除便签已接入二次确认，旧的「点击即生效」危险操作改为弹窗显式确认。
- Storybook Design System v1 已启动：Desktop OS 接入 Tailwind 4、shadcn/base-ui 源码组件、`components.json`、`@/*` alias 和 `PlushPrimitives` 包装层；shadcn 只作为可访问交互底座，视觉方向继续由 Animal Crossing × Pixar 的 storybook miniature token、壳层样式和 Plush 组件掌控。
- 桌面壳层已完成第一轮 storybook miniature 统一：Window、MenuBar、Dock、Launchpad、Spotlight、Control Center 和 Notification Center 使用同一套 surface、panel、field、accent、outline、shadow、motion 和 game-shape token。
- Finder v4 已增强资源库浏览能力：支持资源类型筛选、Cmd/Ctrl 多选、Shift 范围选择、批量收藏、下载、复制链接、Open With、资源包和保存搜索。
- Safari、Account、Weather、Calendar、Notes、Mini Apps 已进入可用阶段，并按现有前端状态与 server 能力逐步接入。
- Account App 已扩展为个人资料面板：登录后从 `/user/info` 读取用户名、角色、下载数和创作者口令，通过 `/user/avatar` 上传头像，通过 `/user/profile` 保存昵称、邮箱和电话，并可绑定 Gmail / QQ 邮箱用于 Mail v1。
- Mail v1 已接入只读统一收件箱：Gmail 通过 OAuth / Gmail API 绑定，QQ 邮箱通过授权码 / IMAP 绑定；服务端加密保存外部邮箱凭据，Desktop OS 以紧凑三栏展示账号、邮件摘要、DOMPurify 清洗后的 HTML 阅读面板、安全文本 fallback、搜索、解绑和手动刷新，不做发信、回复、附件下载或邮件状态修改。
- Blog App v1 已接入 server 公开博客信息：默认进入 Dock、Launchpad 和 Spotlight，使用 `/public/blog/*` 读取公开已发布博客列表、分组、分类、标签和详情，提供搜索、筛选、排序、刷新、加载更多和 `react-markdown` + `remark-gfm` 只读正文阅读；当前不接草稿、私有文章、评论、AI 导读或发布管理。
- Weather App 城市侧栏已调整为浏览优先：默认只展示当前位置和用户添加城市，并隐藏搜索框和删除按钮；当前位置带定位图标，可重新请求浏览器定位；主卡片、小时天气和未来几天按天气文本显示 `public/weather` 状态图标；通过侧栏城市设置面板添加城市、删除已添加城市，当前位置固定保留；已登录用户的添加城市列表通过 user preference 云端同步，未登录时保留本地。
- Mini Apps v2 已扩容为工具优先的启动台应用包：剪贴板、换算器、文本工坊、调色盘、秒表、色珠整理、毛绒花园和云朵弹跳均使用本地状态，不新增 server API 或第三方依赖。
- 毛绒花园已从简易九宫格调整为一屏农场场景：默认窗口展示天空、远山、篱笆、小屋、土地、水塘和装饰，当前阶段先强化农场视觉，不引入后端经营系统。
- Mini Apps v3 已新增工具箱型 App：开发工具箱覆盖 JSON、时间戳、编码、ID/哈希、随机字符串、Diff 和 CSV，日常工具箱覆盖日期、密码、图片和分账；两者默认在 Launchpad/Spotlight 中发现，不默认进入 Dock。
- Mini Apps v3 的通用工具逻辑已抽离到 `@valley/format-tools`：JSON、Query、时间戳、编码、JWT、Hash、随机 ID、随机字符串、CSV、Diff、日期、密码和分账作为 monorepo 纯函数能力复用；图片元数据读取、压缩、改宽和导出归属 `@valley/browser-media`，Desktop OS 只保留窗口 UI、本地草稿、剪贴板和图片工具交互编排。
- Mini Apps v4 已扩展经典小游戏：方块下落和贪吃蛇进入 Launchpad/Spotlight，默认不进 Dock；核心棋盘、碰撞、计分和确定性随机逻辑归属 `@valley/mini-games`，Desktop OS 只负责窗口 UI、输入、通知和本地最高分。
- Mini Apps v4 已新增骰盅：作为本地 5 骰酒桌工具进入 Launchpad/Spotlight，使用 `@react-three/fiber` 渲染真 3D 骰子、底盘和硬质杯盖，支持摇骰、盖住结果和拖拽掀盖，默认不进 Dock，不接后端和持久化历史。
- Music App 已升级到 v2：音乐播放从窗口内本地 `<audio>` 改为桌面全局 `MusicRuntime`，关闭或最小化 Music App 后仍可继续播放。
- Music Runtime 已增加播放缓冲态：点击播放、切歌或音频等待网络时，Music App、顶部音乐小窗和通知中心小组件会显示“加载中”动画，避免 0 秒停留被误判为播放故障。
- 音乐播放器控制与加载态图标统一使用 `lucide-react`，不再用字符符号或手写圆环作为播放、暂停、切歌和加载图标。
- 音乐播放器加载图标采用延迟显示：正常秒播时直接切换为暂停图标，只有缓冲持续超过短暂阈值时才显示加载态，避免按钮闪烁。
- 音乐资源从“少量频道入口”改为静态 `MusicTrack` / `MusicPlaylist` 目录，默认只把可直连播放的音频放入主队列，嵌入和外链来源不再混入核心播放体验。
- Music App 已接入 Audius Trending 免费公开来源：音乐 runtime 激活后通过 Audius REST API 拉取可播放曲目，映射为运行时 `MusicTrack`，不把真实 Bearer Token 写入仓库。
- 菜单栏已增加音乐入口，可直接播放/暂停、切歌，并打开顶部音乐小窗；顶部小窗包含封面、当前曲目、进度、音量、歌词开关和打开完整音乐 App。
- Music App v2 展示播放列表、队列、播放控制、音量、循环/随机、来源授权信息和 LRC-like 歌词面板，歌词支持偏移调整。
- 通知中心音乐小组件显示当前曲目、艺术家、播放状态和进度，并提供播放/暂停与打开音乐入口。
- Dock 右键菜单已改为更接近 macOS 的紧凑毛玻璃菜单：主操作、选项子菜单和 Dock 设置分层展示，并带有轻量弹出动画与 reduced-motion 兜底。
- AI 宠物已移除：不再加载 3D runtime、不保留宠物偏好同步、不维护本地 GLB 资产槽；Dock “AI 工具”改为打开 AI Command Center。
- AI Command Center 多智能体 v1 已升级为云端私有多智能体方向：登录后通过 `/ai/agents` 管理个人私有提示词型智能体，通过智能体会话接口保存云端对话记录；窗口视觉升级为参考图式毛绒三栏智能体 App，左侧是角色化智能体卡片和会话列表，中间是柔和主对话区、建议胶囊和 SSE 流式输入框，右侧是可收起的智能体详情卡与资料编辑区；v1 头像使用 `avatarColor + avatarIcon` 渲染 CSS/Emoji 毛绒头像，不新增图片资产；继续保留 Chat、总结、翻译、改写和 Prompt Lab 快捷指令，v1 不做公开市场、分享链接、知识库、工具调用或图片生成。
- Desktop OS 已完成运行时生命周期治理：窗口内容、音乐 audio runtime、通知中心/控制中心面板和资源数据加载均按打开或使用时激活，窗口焦点提供轻量 `focusedAppId`，拖拽和缩放按 animation frame 合并写入，保留动画和毛玻璃效果但减少关闭态与高频交互开销。
- Desktop OS 已完成后台任务与 App 独立运行治理：普通 App 默认 `foreground-only`，最小化后只保留窗口壳层和状态元数据，业务组件、定时器和局部监听随窗口内容卸载；Music 与 FocusTimer 作为明确后台白名单运行，根组件的全局事件和通知轮询集中到 Gate，Spotlight/Safari/Finder 的资源加载和滚动持久化避开首帧与滚动热路径。

## 动画统一迁移到 motion

- 目标：`apps/desktop-os/src/**/*.tsx` 内 React 进出场 / layout 动画统一通过 `PlushMotion` 原语接入。
- 边界：rAF 直驱 transform（Window 拖动 / Dock magnification / ResizeHandles）与装饰类 `@keyframes`（loading / shimmer / spin / cloud-drift / 控件 pop）不动。
- reduced-motion：被迁组件统一走 `useReducedMotion()`，同名 CSS `@media (prefers-reduced-motion: reduce)` 分支同步删除。
- Phase 进度：P1 PlushMotion 原语 ✅ / P2 窗口层（Window / Spotlight / Dock 菜单）/ P3 面板层（ControlCenter / NotificationCenter / Launchpad）/ P4 业务列表（AICommandCenter / Launchpad 翻页）。
- 工作流档位：C 档，plan / spec 临时存放在 `docs/superpowers/{specs,plans}/2026-06-23-desktop-os-motion-migration*.md`，任务收尾后由 owner 决定是否清理。

## 当前阶段

Desktop OS 继续保持“前端静态能力优先、server 只在已有通用能力成熟时接入”的节奏：

- Dock、Launchpad、Spotlight、窗口系统和通知中心作为桌面基础能力继续稳定。
- Launchpad 动画允许使用 `motion` 承载真实弹簧过渡；其余桌面基础动画仍优先复用现有 CSS token 和 reduced-motion 兜底。
- 桌面运行时默认保持轻量：音乐、资源列表、天气和面板重状态只在对应 App、菜单或面板激活后运行。
- 桌面 App 遵循 macOS 式生命周期：窗口打开或恢复时运行业务内容，普通窗口最小化后卸载业务内容，只有播放中的音乐、运行中的专注计时和桌面壳必要事件允许后台继续运行。
- Finder 继续使用 server 公开资源模型，不扩展为真实文件系统。
- Finder v4 优先增强资源浏览器心智：右键菜单、Quick Look 上/下一张、最近浏览/下载记录、Open With、资源包、保存搜索和每个位置的视图状态记忆均使用前端本地状态，不新增后端接口。
- Music v2 不新增后端服务，不做完整曲库、搜索、会员、登录或歌词抓取；Audius 仅作为免费公开趋势曲目来源接入。
- 音乐资源先由前端静态目录维护；后续如需后台配置，再扩展 server Resource 为 `music/audio` 元数据，只保存标题、艺术家、封面、外链、授权和音频地址，不自建流媒体服务。
- Audius Bearer Token 只通过本地 `.env` 配置注入；因 Vite 前端环境变量会暴露到浏览器，生产环境如需保护 token，应改为 server 代理。
- 不使用网易云、QQ、酷狗等非官方 API；如需主流版权音乐，只做外部平台打开或后续商业授权接入。
- Mini Apps 继续以 Launchpad 和 Spotlight 作为主入口；新增小工具和小游戏默认不进 Dock，只能由用户在 Dock 设置中手动显示。
- 剪贴板只在用户点击时读取浏览器剪贴板；调色盘取色能力按浏览器支持渐进增强。
- 通知中心只展示工具摘要和小游戏最佳，不为每个 Mini App 单独增加小组件。
- 工具箱 v3 保持本地运行，不新增第三方运行时依赖；通用纯函数归属 `@valley/format-tools`，浏览器图片处理归属 `@valley/browser-media`，密码、随机字符串和图片处理结果不持久化，图片只通过浏览器本地 canvas 处理。
- 经典小游戏 v4 保持本地运行，不新增第三方游戏库、不使用 Canvas；方块和贪吃蛇规则通过 `@valley/mini-games` 测试覆盖，Desktop OS 保存最高分摘要。
- 骰盅保持本地窗口状态，允许使用 Three/R3F 承载真 3D 舞台；碰撞采用本地轻量落点分离，不引入物理引擎；只提供摇骰、盖盅、拖拽掀盖和点数查看，不进入大话骰或输赢规则。
- 二维码、完整 Markdown 预览、HTTP API 调试器和汇率换算暂缓，等待依赖、CORS 或外部数据源策略明确后再评估。
- AI Command Center 作为 Dock、Launchpad 和 Spotlight 可打开的真实窗口；当前阶段接入 `/ai/agents` 云端私有智能体和云端会话记录，视觉方向是参考图式毛绒三栏智能体布局，聚焦总结、翻译、改写、Prompt Lab、通用问答和提示词型个人智能体，不再推进 3D 宠物或宠物工坊。
- Mail App 作为 Dock、Launchpad 和 Spotlight 可打开的真实窗口；第一阶段只读外部收件箱，绑定入口放在 Account App，邮件凭据只进入服务端加密存储。
- Blog App 作为 Dock、Launchpad 和 Spotlight 可打开的真实窗口；第一阶段只读公开已发布博客，复用现有公开接口，不新增 server API，正文使用 `react-markdown` + `remark-gfm` 渲染 Markdown，不渲染原始 HTML。
- Storybook Design System v1 的优先级高于全量应用窗口重做：先稳定壳层、公共控件和 shadcn 混合底座，再逐步把 Finder、AI Command Center、Music、Weather 等高频窗口迁到 `PlushPrimitives`，避免一次性重写造成业务回退。
- 公共滚动体验由 `PlushScrollbar` 封装第三方 overlay scrollbar 能力，应用窗口和高频滚动面板优先接入该组件，不直接暴露浏览器默认滚动条或第三方默认主题。

## 下一步顺序

1. Storybook Design System v1：继续把按钮、输入、菜单、弹窗、卡片、空状态、加载态和高频窗口入口迁到 `PlushPrimitives`，保持 shadcn 只做底层交互能力。
2. Music v2 资源增强：继续评估 Jamendo、Pixabay 和 Internet Archive；Audius 已作为免费公开趋势曲目来源接入，下一步优化筛选、分类和曲目质量。
3. Safari v3：已完成多标签页（含拖拽排序、上限 12、关闭最后一个自动新建起始页 tab）、最近访问与收藏（本地 `localStorage` 持久化，LRU 24 / 收藏 64，起始页只展示前 12）、起始页三分组（资源 / 最近访问 / 收藏，可折叠，空分组冷启动隐藏）、embed-limited 失败页（4 个快捷操作 + 复制链接 toast + 加入/已收藏切换）和 Cmd/Ctrl + T/W/L/R 快捷键（仅 Safari 聚焦时生效）；不新增 server API，不引入新依赖。
4. Dock / App 系统 v2：完善应用占位状态、窗口布局偏好和更多系统应用入口。
5. Mini Apps v5：评估工具数据账号同步、用户可配置启动台分组、二维码、Markdown 预览和小游戏成绩榜。
6. Mail v2：评估后台定时同步、已读/星标/归档、附件预览和更多邮箱 provider。
7. 通知中心 + 小组件 v2：资源动态、博客动态、登录态、更多真实数据源和可配置小组件。
8. Notes v2：评估是否从 Life Trace Inbox 迁移到独立 `/user/notes` 数据模型。
9. AI Command Center v2：评估常用指令收藏、跨 App 选中文本发送、图片工具、知识库、工具调用和更明确的任务型 Agent 编排。

## 验收标准

- 打开 desktop-os 后不再自动弹出“关于本机”。
- Dock、菜单栏、Launchpad、Spotlight、窗口拖拽、缩放、最小化和关闭行为不回退。
- Dock 和菜单栏打开 Launchpad 时有接近 macOS 的缩放、淡入和轻微模糊过渡；关闭和分页切换动画流畅，并遵守系统 reduced-motion 设置。
- Launchpad 支持左右分页、分页指示点、上一页/下一页按钮、键盘左右翻页，以及在页面空白区域按住后横向拖拽翻页；拖拽时光标切换为 grabbing，375px、768px、1024px、1440px 下不横向溢出。
- Launchpad App item 默认态不显示卡片底板或强阴影，只保留图标轻投影；hover 只强化图标和标题，键盘选中态才显示轻量高亮。
- 首次打开 Desktop OS 时不自动拉取 Audius、不自动加载资源列表；打开 Music、Finder/Safari/Spotlight 后再激活对应逻辑。
- 首次打开 Desktop OS 时不启动 Finder、Safari、Spotlight、小游戏等业务组件的定时器、键盘监听或资源请求；打开对应 App 或面板后才激活，最小化普通 App 后业务组件卸载。
- 窗口聚焦、拖拽、缩放或最小化不触发未变化窗口的 App 内容重渲染；菜单栏只订阅轻量 `focusedId`/`focusedAppId`，不随窗口坐标变化刷新；Dock 和 Launchpad 的运行中状态只依赖轻量运行 App 列表。
- `windowStore` 同时维护 `runningAppIds`、`visibleAppIds` 和 `activeAppIds`；focus、move、resize 不改变 App 运行集合，minimize 只把普通 App 移出 visible/active 集合。
- `App.tsx` 不直接承载通知轮询 interval 或全局 DOM listener；全局 keyboard/context/online/offline 事件集中在 `DesktopGlobalEvents`，通知轮询集中在 `NotificationPollingGate`，页面 hidden 时暂停轮询。
- 菜单栏时钟由 `ClockGate` 承载，MenuBar 本体不包含时钟 interval；顶部音乐入口在未播放、未激活音乐 runtime 时保持轻量显示。
- Spotlight 关闭态只订阅打开状态，不订阅资源列表；打开后再加载资源并执行资源搜索。
- Safari 打开外部网页时不加载资源推荐；只有处于起始页且没有当前 URL 时才在 idle 阶段加载资源快捷方式。
- Finder 滚动位置记忆不在 scroll event 中同步写 `localStorage`；滚动状态先经 requestAnimationFrame 合并，Finder 本地持久化通过 debounce 写入。
- `PlushImage` 默认使用 lazy loading 和 async decoding；Finder Inspector、Quick Look 等需要立即展示的大图可显式覆盖加载策略。
- 控制中心和通知中心关闭时不订阅天气、音乐进度、小工具统计等重状态；打开后保持原有动画和功能。
- Finder/Safari/Weather/Calendar/Notes/Account/Mini Apps 保持当前可用能力。
- Safari 顶部展示 tab bar，可新建、关闭和拖拽排序；tab 上限 12，超出阻止并提示；关闭最后一个 tab 后自动新建起始页 tab。
- Cmd/Ctrl + T / W / L / R 在 Safari 聚焦时生效，且不触碰其它 App 焦点；除 Cmd+L 外，事件目标位于地址栏 input 内时不触发。
- 起始页展示资源 / 最近访问 / 收藏三组，每组可折叠，折叠态刷新后保留；最近访问与收藏为空时不渲染分组头，资源分组始终渲染并以 `EmptyState` 承载 loading / error / empty 状态。
- 访问任意非起始页 URL 后，该 URL 写入“最近访问”，上限 24 条，LRU 排序；刷新桌面后保留；可在起始页 hover 卡片右上角“✕ 移除”单条。
- 当前网页可一键加入或取消“收藏”；收藏列表上限 64 条，起始页只展示前 12 条；刷新桌面后保留；可在起始页 hover 卡片右上角“★ 取消”单条。
- iframe `embed-limited` 文案改为“网站可能拒绝在 Safari 内嵌入显示”，并提供新窗口打开 / 重试 / 复制链接 / 加入收藏 四个操作；`tone="danger"` 自动带 `role="alert"`；复制链接成功后按钮文案 3s 内显示“已复制”，已收藏时文案变“已收藏”且 disabled。
- 同源网页能在 tab 标题与最近访问中显示页面 `<title>`；跨域降级为 URL hostname，不抛错。
- 切换 tab 不重新加载活跃配额内的 iframe（active + 最近 3 个非起始页 tab，共 4 个）；非配额 tab 切回时重新加载，状态留在 store 不丢失。
- 刷新桌面后 tabs / activeTabId / recents / bookmarks / collapsedSections 全部从 `desktop-os-browser-v3` 恢复，但 `status` 重置为 `loading` 或 `home`、`reloadKey` 重置为 0；旧的非 v3 key 不做迁移；history / future 持久化时各截断到 50 条。
- Dock 点击“AI 工具”可打开 AI Command Center 窗口；Launchpad 和 Spotlight 可搜索 `AI`、`summary`、`translate`、`prompt`、总结、翻译、改写和提示词。
- AI Command Center 使用参考图式毛绒三栏对话布局：左侧展示角色化智能体卡片和当前智能体会话，中间展示当前对话流、底部建议胶囊和输入框，右侧智能体资料卡可收起并可编辑；输入框支持 Enter 发送、Shift+Enter 换行，发送消息、流式输出和切换会话时默认滚动到底部；输入框 focus 不出现浏览器默认描边，底部阴影保持克制。
- AI Command Center 登录后可创建、切换、编辑和删除多个个人私有智能体；新增智能体先打开创建弹窗，用户确认后才写入云端和列表；智能体配置通过 `/ai/agents` 云端保存，不进入公开市场、模板广场或分享流。
- AI Command Center 可为每个智能体新建、切换和删除云端会话；刷新页面后智能体和对话记录仍从云端恢复，不再依赖本地 `desktop-os-ai-command-history-v1` 作为主存储。
- AI Command Center 登录后通过 `/ai/agents/:agentId/conversations/:conversationId/chat` 调用 ARK，支持 Chat、总结、翻译、改写和 Prompt Lab 五种模式，并以 SSE delta 实时输出助手回复；未登录时显示“登录后使用”，不会创建智能体、编辑资料或发起聊天请求。
- AI Command Center 切换智能体或会话时有轻量淡入和位移动效，列表选中态、消息出现和弹窗打开遵守 reduced-motion 设置。
- AI Command Center 请求失败或服务端未配置 ARK 时，窗口显示错误状态，不影响 Dock、窗口管理和其它 App。
- Account 登录后可查看扩展用户信息，可通过头像上传控件更换头像，并能保存昵称、邮箱和电话；保存成功后当前窗口展示最新资料，不影响收藏、下载和资源刷新。
- Account 登录后可查看已绑定邮箱账号，可打开 Gmail 授权页，可用 QQ 邮箱地址和授权码绑定 QQ 邮箱，并可解绑邮箱账号；界面不展示外部邮箱 token、授权码或密文。
- Dock 点击“邮件”可打开 Mail 窗口；Launchpad 和 Spotlight 可搜索 `mail`、`email`、`inbox`、邮件、邮箱和收件箱。
- Mail 窗口登录后展示统一收件箱、轻量账号侧栏、搜索框、可扫读邮件列表、安全阅读面板和手动刷新；有 HTML 正文的邮件通过 DOMPurify 清洗后在 sandbox iframe 中渲染，无 HTML 正文时按段落、链接和引用渲染为 React 文本节点；未登录或未绑定邮箱时显示空状态，不发起无效同步。
- Mail v1 只读外部收件箱，不提供发信、回复、附件下载、已读/星标/归档状态修改。
- Dock 点击“博客”可打开 Blog 窗口；Launchpad 和 Spotlight 可搜索 `blog`、`post`、`article`、博客、文章和阅读。
- Blog 窗口打开后才拉取公开博客数据，Desktop 根组件不主动加载博客列表。
- Blog 窗口展示公开已发布博客列表、封面、摘要、作者/时间/浏览量、分组、分类、标签、搜索框、筛选、排序、刷新和加载更多。
- Blog 详情以 `react-markdown` + `remark-gfm` 展示 Markdown 正文，不使用 `dangerouslySetInnerHTML`，不提供编辑、删除、发布、评论或 AI 导读入口。
- Blog 接口请求失败时显示错误状态，不影响 Dock、窗口管理和其它 App。
- Weather App 默认城市列表只用于切换城市，只展示当前位置和用户添加城市，不展示搜索框或删除按钮；当前位置行显示定位图标并可重新定位，定位失败时不清空原天气；主卡片、小时天气和未来几天能按晴、阴、雨、雪、雾霾等天气文本切换状态图标；城市设置面板可添加城市、删除已添加城市，当前位置不可删除；刷新页面后已添加城市不会丢失，登录后可从云端偏好恢复。
- Launchpad 能按工具/小游戏分组展示剪贴板、换算器、文本工坊、调色盘、秒表、色珠整理、毛绒花园和云朵弹跳。
- Spotlight 能按中英文关键词搜索并打开 Mini Apps v2 的 8 个新增应用。
- 默认 Dock 不显示 Mini Apps v2；在 Dock 设置中手动显示后，Dock 能打开对应窗口。
- Dock 右键菜单打开时有轻量弹出动画；选项项可展开子菜单，并提供“在 Dock 中保留”和“从 Dock 中移除”。
- 刷新页面后，剪贴板片段、换算历史、文本草稿、收藏颜色、秒表记录、色珠整理最佳成绩、毛绒花园进度和云朵弹跳最高分仍保留。
- 剪贴板可手动读取、保存、置顶、复制和删除片段；浏览器拒绝剪贴板权限时界面保持可用。
- 换算器可离线完成长度、重量、温度、时间和数据大小换算。
- 文本工坊可统计文本并完成大小写、Slug、空白清理和 URL 编解码。
- 调色盘可保存颜色、复制 HEX、生成 5 色色板，并在浏览器支持时使用取色。
- 秒表可开始、暂停、重置、计次和使用倒计时预设。
- Launchpad 能展示并打开开发工具箱和日常工具箱，Spotlight 搜索 JSON、时间戳、Base64、UUID、随机字符串、CSV、密码、日期、图片和分账能命中工具箱。
- 开发工具箱可完成 JSON 格式化/压缩/Query 转换、时间戳互转、Base64/URL/JWT 解码、UUID/token/随机字符串/密码/SHA 生成、文本 Diff 和 CSV/JSON/Markdown table 转换。
- 日常工具箱可完成日期差和日期加减、密码生成、本地图片压缩/改宽/导出，以及多人分账计算。
- 密码和随机字符串生成结果刷新后不保留；图片工具只处理本地文件，不上传 server。
- 色珠整理可完成归类谜题并记录最佳步数和耗时；毛绒花园可在一屏农场场景中浇水开花并保存装饰进度；云朵弹跳可重开并记录最高分。
- 方块下落可开始、暂停、继续、重开和结束，支持方向键移动、旋转、软降、空格硬降，并记录最高分、行数和等级。
- 贪吃蛇可开始、暂停、继续、重开和结束，支持方向键/WASD 与屏幕按钮转向，禁止直接反向转向，并记录最高分和长度。
- Launchpad 能在小游戏分组展示并打开骰盅；Spotlight 搜索骰子、骰盅、dice 和喝酒能打开骰盅。
- 骰盅默认不显示在 Dock；用户在 Dock 设置中手动显示后可从 Dock 打开。
- 骰盅窗口默认一屏展示，不出现默认滚动条；点击摇或重摇后，5 个真 3D 骰子会旋转、跳动并落在不重叠的位置，动画结束后结果仍被盖住。
- 骰盅支持鼠标和触屏拖拽掀盖；杯盖作为 Three group 整体移动和旋转，不做 scale 变形；掀开后显示 5 个骰子点数和总点数，盖上后结果被遮住。
- 通知中心工具小组件展示本地工具摘要，小游戏小组件展示新增游戏最佳或花园进度。
- Finder 资源网格默认不展示操作按钮，图片缩略图不裁切主体；hover 时才在缩略图底部浮出预览、打开和收藏等高频操作，不遮挡类型和收藏标签。
- Finder 资源列表使用稳定 gallery tile 排版，标题和来源有清晰层级；右侧 Inspector 以资源名片方式呈现，包含有质感的大预览、标题摘要、软卡片元信息、贴纸式标签和主次分明的动作区，不出现文字拥挤、按钮堆叠或信息流混乱。
- Finder 资源工具栏提供刷新入口；刷新会重新拉取资源并触发资源图片重新加载，适配 TOS 图片临时网络失败但对象仍存在的场景。
- Finder 资源缩略图、右侧详情预览和 Quick Look 图片失败时显示统一的 PlushImage 兜底，不出现浏览器默认破图图标，并支持单图重试。
- Finder Quick Look、Finder 资源加载、Safari 起始页资源加载和 Notes 同步加载使用统一的 PlushLoading；加载态有明确视觉焦点、短文案、reduced-motion 兜底，不再出现裸文字加载。
- Finder 加载更多和已显示全部使用统一的 PlushLoadMore，不再出现裸文本或和系统风格不一致的按钮。
- Finder、Calendar 和 Mini Apps 内的下拉菜单使用统一的 PlushSelect，展开菜单、选中态、hover 态和键盘操作保持 Desktop OS 风格一致。
- 应用窗口、Finder 侧栏、Finder 资源区和 Finder 详情区的滚动条默认空闲隐藏，滚动时显示轻量 overlay thumb，滚动交互不挤压内容、不改变布局宽度、不露出第三方默认主题。
- Desktop OS 的 Tailwind/shadcn 接入不应暴露默认 SaaS 风：新增 UI 应优先通过 `PlushPrimitives` 或既有 `Plush*` 组件进入页面，按钮、弹窗、菜单、输入、卡片和骨架屏需保持 storybook miniature 的圆润形状、轻体积和柔和长投影。
- Window、MenuBar、Dock、Launchpad、Spotlight、Control Center 和 Notification Center 的壳层视觉需使用同一套 Storybook Design System token，不出现彼此割裂的普通暖色卡片、默认蓝色菜单 hover 或裸浏览器控件。
- Finder 顶部可按全部、图片、网页、工具和可下载资源筛选；搜索、标签和类型筛选可组合，并能单独清除。
- Finder 支持 Cmd/Ctrl 多选和 Shift 范围选择；多选后显示批量操作条，可收藏未收藏资源、下载资源、复制链接和清除选择。
- Finder 资源右键菜单可执行预览、打开、收藏、下载、复制链接、查看详情和按资源类型展示 Open With。
- Finder Inspector 展示 Open With 入口；图片可进入 Quick Look，网页可用 Safari 打开，文本/链接资源可发送到 Notes 或文本工具，工具类资源可发送到开发工具箱。
- Finder 可从当前资源或多选资源创建资源包，并在侧边栏打开或删除；资源包使用本地状态保存，不伪装成真实文件夹。
- Finder 可保存当前搜索条件，包含搜索词、标签、排序和类型筛选，并可从侧边栏恢复或删除；保存搜索使用本地状态保存，不新增后端接口。
- Finder 图片 Quick Look 支持键盘左右切换和底部上一张/下一张按钮，Escape 可关闭预览。
- Finder 最近浏览由用户预览或打开资源产生，下载资料由用户下载资源产生，刷新后仍保留本地记录。
- Finder 每个路径或标签可恢复视图模式、排序、滚动位置和选中项。
- Dock 点击“音乐”可打开 Music App，窗口内可切换播放列表和曲目。
- Music App 可显示 Audius Trending 播放列表；Audius 拉取失败时显示错误和重试，不影响静态曲目播放。
- 音乐播放由按需激活的全局 `MusicRuntime` 承载，关闭或最小化 Music App 后音乐继续播放。
- 点击播放、切歌或网络缓冲时，音乐窗口、顶部音乐入口和通知中心音乐小组件显示加载动画；音频可以播放后自动恢复播放中状态。
- 音乐播放器的播放、暂停、切歌和加载图标使用 lucide 图标，顶部按钮状态与真实 audio 播放事件保持一致。
- 正常可秒播的曲目点击播放后不应短暂闪现“加载中”；只有真实缓冲超过短暂阈值时才显示加载图标。
- 菜单栏音乐入口可显示当前曲目，并支持播放/暂停、下一首和打开顶部音乐小窗。
- 顶部音乐小窗可控制播放、进度、音量、歌词开关，并能打开完整 Music App。
- Music App 歌词可显示并跟随播放进度，高亮当前行；无歌词或歌词关闭时不报错。
- 通知中心音乐小组件显示当前曲目、艺术家、播放状态和进度，并可播放/暂停或打开 Music App。
- 音频失效时桌面不崩溃，播放器显示错误状态并允许切换其他曲目。
- `pnpm --filter @valley/browser-media test`、`pnpm --filter @valley/browser-media typecheck`、`pnpm --filter @valley/browser-media check` 和 `pnpm --filter @valley/browser-media build` 通过。
- `pnpm --filter @valley/mini-games test`、`pnpm --filter @valley/mini-games typecheck`、`pnpm --filter @valley/mini-games check` 和 `pnpm --filter @valley/mini-games build` 通过。
- `pnpm --filter @valley/format-tools test`、`pnpm --filter @valley/format-tools typecheck`、`pnpm --filter @valley/format-tools check` 和 `pnpm --filter @valley/format-tools build` 通过。
- `pnpm --filter @valley/desktop-os typecheck` 和 `pnpm --filter @valley/desktop-os check` 通过。

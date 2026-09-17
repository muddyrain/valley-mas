# 首页、路线与今日行动素材

## Expedition 搜索状态卡（2026-09-17）

用户提供 `蓝时归航_Expedition_搜索状态卡_V1_UI素材包.zip`，四张原始 PNG 保存于 `assets/ui/expedition/search/`，Godot Lossless 导入；预览仅用于布局对照，不作为运行时整图。

| 文件 | 原始尺寸 | 运行时用途 |
| --- | --- | --- |
| `search_active_panel.png` | 262×96 | 固定尺寸背景，保留原图指针 |
| `search_cancel_normal.png` | 96×32 | 取消按钮 normal，与 hover 共用固定 96×32 控件，原尺寸居中绘制 |
| `search_cancel_hover.png` | 96×32 | 取消按钮 hover / pressed |
| `search_state_icon.png` | 24×24 | 搜索状态图标，显示 16×16 |

`ui/expedition/search_card.gd` 动态绑定建筑/车辆图标、地点名、搜索状态、百分比；9px 进度条由 Godot `ProgressBar` / `StyleBoxFlat` 绘制。只显示正在室内或室外搜索的存活执行者，赶路、进入、自卫、取消、退出和完成均不显示。`poi_context.gd` 每帧核对任务，将卡片固定在 SearchUIAnchor 上方；边缘微调最多横向 24 / 纵向 12 个 UI 单位，空间不足时隐藏，禁止跨建筑重新选址。不恢复旧建筑说明框。

取消按钮位于 `(158,36)`，`custom_minimum_size` 和 `size` 均为 96×32；保留纹理固有最小尺寸，水平使用 `SIZE_SHRINK_CENTER`、垂直使用 `SIZE_SHRINK_BEGIN`，纹理使用 `STRETCH_KEEP_CENTERED`。文字和内边距已包含在原始 PNG 中，不叠加 Label 或额外 padding。262×96 卡片中的 `SearchRow` 使用 HBoxContainer，95px 信息区与按钮之间固定 `separation = 12`；两态间距相同。进度条为 86×9，状态文字与百分比保持 2px 间隔，按钮右侧保持 8px 留边。

原生验收入口：`tests/search_active_card.gd`，已纳入 `run.ps1 -Mode capture/build`；间距微调后的截图、坐标和断言写入 `test-output/search-cancel-spacing/`，157 项断言通过，包含两态 12px 间距、原生尺寸、状态/百分比文字完整显示及三档分辨率。运行同时报告 GLES3 空纹理错误，不能视为无错误验收。此前按钮尺寸、定位修复和首次接入截图分别保留在 `test-output/search-cancel-layout/`、`test-output/search-card-position/`、`test-output/search-active-card/`。验证使用独立内存 Campaign 和合成输入，不写入玩家存档。四张 PNG 的 SHA-256 与 ZIP 原件一致，按钮微调未改 PNG；构建状态见 [实施计划](../docs/PLAN.md)。

## Camp M03 顶部资源栏（2026-09-17）

用户 `m03_assets_final.zip` 六张 PNG 原字节保存于 `assets/ui/camp/m03/`，逐张 SHA-256 与原包一致。资源背景 206×112 → 103×56，三个资源图标 64×64 → 30×30，菜单背景 232×112 → 116×56，菜单图标 48×48 → 24×24。背景共用，文字由 Godot Label 渲染；无额外 PNG 或 gameplay 接入。尺寸、节点与验证见 [M03 接入报告](../docs/CAMP_RESOURCE_BAR_REPORT.md)。

## Camp M02 时间状态栏（2026-09-17）

用户 `m02_assets_final.zip` 原件保存于 `assets/ui/camp/m02/`：`m02_status_bar_bg.png`（1136×152）等比显示 568×76，`m02_icon_sun_day.png`（64×64）等比显示 28×28。两张 SHA-256 均与包内原件一致，未重新生成或修改像素。Godot Lossless 导入、透明边缘修复与线性过滤。

背景自带的两根分隔线定义左/中/右区域；轨道和四个圆形节点使用 Godot StyleBoxFlat 绘制，全部文字为独立 Label，无额外 PNG。M01 维持冻结，M03～M09 保持骨架。资源哈希、尺寸、节点及运行记录见 [M02 接入报告](../docs/CAMP_TIME_STATUS_REPORT.md)。

## Camp M01 营地身份区（2026-09-16）

2026-09-17 最新卡片使用用户 `camp_identity_panel_bg_v3.zip` 内 `camp_identity_panel_bg_v3.png`，1599×984，保存到原运行路径 `assets/ui/camp/m01/camp_identity_panel_bg.png`，原字节哈希一致。控件 266×164 等比容纳，可见纸面宽约 247 px；Logo 保持 V2 tight 版本与当前位置。以下为历史接入记录。

2026-09-17 按用户提供的 `blue_hour_camp_m01_assets_v2_tight.zip` 原件替换同路径 PNG：`camp_logo_main.png` 394×174，`camp_identity_panel_bg.png` 408×251；SHA-256 对照原包一致。控件等比显示 232×103 / 252×155，可见宽约 226/246 px，字体保持原 Typography 修订。以下为首轮资源来源记录，当前尺寸以本段为准。

用户提供 `blue_hour_camp_m01_assets.zip`，仅含 `camp_logo_main.png`（480×176）与 `camp_identity_panel_bg.png`（412×300）。两张 PNG 原始字节保存于 `assets/ui/camp/m01/`，已逐张 SHA-256 对照压缩包确认一致。Godot 使用 Lossless、原尺寸、透明边缘修复与线性过滤；TextureRect 等比居中显示为约 212×78 和 206×150，不裁切、不拉伸、不增加新图。

M01 使用独立 Label 渲染东岸营地、中英文日期及两行描述，字体复用项目现有 SystemFont 回退方式。外层布局及 M02～M09 保持 M00。详细节点、验证与范围见 [M01 接入报告](../docs/CAMP_IDENTITY_REPORT.md)。

## 今日行动选择（2026-09-12）

用户提供的 `蓝时归航_今日行动_UI素材包.zip` 含 10 张 PNG 与一份素材说明。原始 PNG 字节保留，按用途改为小写语义文件名，全部位于 `assets/ui/today_action/`。`sources.json` 记录原名、现名、原尺寸与 SHA-256；原说明保存在 `source_notes.txt`，只作为来源资料。

主面板使用 NinePatchRect；任务卡、顶部状态条、选中信息条和三个颜色的按钮底图使用 Godot 区域切片，去掉透明留白但不改源图。住宅区、商业街、空投回收缩略图等比覆盖卡片图片槽，图上的天空和地面会居中裁切。文字、库存、任务指标和确认/返回按钮均为原生控件。蓝色底图表示确认按钮不可用，选中后使用绿色；返回营地使用红色。

复用现有首页背景、Logo、系统中文字体和 `PaperCardHover` 的纸卡抬升、按压与透明轮廓反馈。1600×900 参考画布等比完整容纳，背景覆盖其余宽高。页面逻辑、来源边界及运行证据见[今日行动记录](../docs/TODAY_ACTION.md)。

当前文件名已规范为小写语义命名，完整旧名 → 新名清单及导入验证见 [命名迁移记录](../docs/ASSET_NAMING_2026-09-12.md)。下文保留各次素材接入的来源与视觉说明。

2026-09-09，0.4.1。按用户最后提供的 1919×1080 首页设计稿接入素材。菜单、图标与文字是原生 Godot 控件；没有把整张设计稿当成可点击界面。海报按要求整张展示、不接交互。玩法继续使用 0.4.0 的开局与存档流程。

## 原图与切片

首页专属的导航图标、海报和社交入口保存在 `assets/ui/main_menu/`；共享背景、品牌、纸板与按钮分别归入 `assets/ui/common/` 的对应类型目录。未修改 PNG 像素或重新生成美术。来源文件名、尺寸、SHA-256 仍见 `assets/ui/main_menu/sources.json`，其中 `file` 相对清单所在目录解析。较早的 `logo.png` 已在 2026-09-12 确认无有效引用后清理。当前目录与逐项迁移见 [资源目录说明](RESOURCE_LAYOUT.md)及[迁移记录](../docs/ASSET_MIGRATION_2026-09-12.md)。

| 资源 | 原始尺寸 | 使用方式 |
| --- | --- | --- |
| `ui_common_background.png` | 1919×1080 | 铺满窗口、等比覆盖；首页使用轻微降饱和与冷暖校色 |
| `ui_common_logo_tagline.png` | 1774×887 | 首页 Logo + 标语取 `(160,0,1460,887)`；创建页取上方 Logo |
| `main_menu_navigation_icons_normal.png` / `main_menu_navigation_icons_hover.png` | 各 128×768 | 六行，每格 128×128；导航焦点或鼠标悬停切换为白色图标 |
| `main_menu_social_entries.png` | 2172×724 | 三列，每格 724×724；取每格 `(146,56,500,482)` 的圆形区域，下方文字由控件显示 |
| `main_menu_poster.png` | 1086×1448 | 完整保留纸张、胶带、便签及图文，不创建按钮热区 |
| `ui_common_paper_panel.png` | 2172×724 | 纸板视图 `(110,140,1954,439)`；首页按钮取内缘 `(134,164,1903,390)` |
| `ui_common_blue_button_normal.png` | 2172×724 | 创建页按钮视图 `(184,112,1802,500)` |

切片通过 AtlasTexture 或绘制区域完成，保持原始透明通道。首页使用 1919×1080 参考画布，窗口改变时等比容纳居中；多余宽高由背景覆盖。Logo、菜单列、海报和底部入口锚定于参考画布，六个菜单由 VBoxContainer 排列。返回游戏时恢复既有缩放策略，不改变基地与行动布局。

## 交互范围

- 开始游戏进入原有专精选择；取消不写档，覆盖现有旅程仍需原有确认。
- 有存档时“继续”优先获得焦点；无存档仍保留稿中的菜单位置，点击说明尚无存档。
- 角色图鉴只读展示现有三名角色和特质；营地档案只读展示本轮队伍和库存；设置提供当前窗口全屏切换，不新增持久设置系统。
- 愿望单、社区尚无已发布地址，制作组资料未提供，点击明确显示当前状态，不连接虚构地址。
- 鼠标悬停、键盘与手柄共享一个可见焦点；弹层限制焦点，Esc / 手柄 B 返回原入口。

## 要达到逐像素一致仍需补齐的原稿素材

以下尺寸仅用于定位，以最后一张 1919×1080 设计稿为准。最好从分层原稿导出透明 PNG，保留抗锯齿和外发光，不带黑底；建议 2 倍尺寸。当前界面没有虚构这些装饰。

| 建议文件名 | 稿中位置与内容 | 导出要求 |
| --- | --- | --- |
| `window_motto.png` | 中央窗户约 `(1000,260,290,110)`，天还没黑，而我们正走向明天，含下划线 | 只导出手写字与笔画 |
| `homeward_note.png` | 右下地图约 `(1545,860,180,105)`，回家的路，一定会有的 | 便签纸与字一起导出 |
| `stay_safe_mug.png` | 右下杯子约 `(1688,904,105,112)` | 带完整杯身文字的杯子，或将其合入背景 |
| `menu_paper.png` / `menu_blue.png` | 普通按钮约 373×70；高亮按钮约 385×78，外发光另留边 | 与最终稿同款的空白底图，不含字和图标；现有纸板的边角及蓝色描边不同 |

另有**素材版本差异**：这次提供的 Logo 带较亮浮雕，底部圆形入口带星芒和横幅，海报图文也与设计稿有细节差别。当前使用的是用户明确提供的独立素材；严格逐像素目标需要它们在最终稿中的同版切图。菜单字体未提供，当前使用系统微软雅黑 UI 粗体；准确字形需要原稿字体或菜单文字切片。页脚显示真实 `0.4.1`，不把设计稿中的示例年份、制作组署名当成项目事实。

## 验证入口

`run.ps1 -Mode capture` 包含 `tests/menu_runtime.gd`，覆盖六种窗口比例、白色悬停图标、键盘/手柄、菜单弹层焦点、未创建存档状态、专精切换与继续存档。原生截图和完整日志保存在忽略提交的 `test-output/menu/`。最终构建及人工边界见 [验证记录](../docs/VALIDATION.md)。

## 路线选择页

2026-09-10，用户提供 41 张透明 PNG 切片与 1672×941 组合参考图；2026-09-11 又补充了作战、搜集、勘查三张 300×160 选中高亮底图。2026-09-12 按现有用途归类：路线专属切片位于 `assets/ui/route_selection/`，公共组件位于 `assets/ui/common/`，道具与技能素材分别位于 `assets/items/`、`assets/skills/`。保留图片的文件名和字节不变，已被当前实现替代的 4 张旧切片见迁移记录。原始文件名、尺寸、SHA-256 及派生关系仍记录在 `assets/ui/route_selection/sources.json`；`file` 相对清单目录解析，原始外部来源名不改写。

路线页复用首页 1919×1080 背景，在居中的 1672×941 参考画布上组合品牌、标题、四张路线标签、主纸板、两张奖励卡、详情提示、路线预览、进度条和操作按钮。窗口的多余宽高仍只交给背景；参考画布按比例完整容纳，因此 1024×640、4:3、16:9 与超宽屏不会裁掉操作区。鼠标、键盘和手柄继续共用可见焦点。

三条可用路线仅在被确认选中时切换到同色系的专属高亮底图，并保留左上胶带标记；鼠标悬停以及键盘、手柄仅移动焦点，不改变路线背景。三张高亮图的运行时版本统一为 300×160 画布及同一有效外框；原始搜集、勘查图保留不动，规范化派生图只校正透明留白内的主体尺寸。界面始终使用同一个位置和矩形换图，不再按状态移动或缩放控件。

四张路线标签使用同一信息层级：图标与路线名组成居中的标题组，进度数字和轨道共用中轴，描述缩为次级文字并完整停留在主纸板遮挡线以上。图标按标题字重统一收小并留出上沿安全间距，斜向的作战图标也不会越过标签轮廓。普通、选中和锁定状态复用这套内容布局，不因背景切换发生位移。

当前真实玩法仍只有作战、搜集、勘查三条路线。第四张标签、`0/21`、`0/125` 与“查看解锁”用于匹配用户指定的路线成长视觉；点击后只显示“尚未解锁”，不写入跨局经验、不创建解锁树，也不改变 `NEW_RUN_SPEC` 的 0.4.0 玩法边界。卡片标题、说明和详情从当前专精 Resource 刷新，确认仍走原有草稿、覆盖确认与保存成功后创建 Run 的流程。

作战路线的 `item_shooting_target_card.png`、`skill_rage_card.png` 与勘查路线的 `item_coffee_card.png`、`skill_map_healing_card.png` 是用户提供的完整透明卡面。道具卡面 `item_shooting_target_card.png`、`item_coffee_card.png` 与 `item_replicator_card.png` 归入 `assets/items/cards/`；技能卡面 `skill_rage_card.png`、`skill_map_healing_card.png` 与 `skill_sprint_card.png` 归入 `assets/skills/cards/`。它们表现具体道具和能力，不归属于某条路线；界面继续直接使用完整卡面，不叠加通用蓝色占位画刷。

`tests/new_run_runtime.gd` 覆盖三条路线切换、两张奖励卡与详情提示；`tests/menu_runtime.gd` 额外覆盖 1672×941 参考尺寸、锁定预览和多比例安全区截图。

## 外出 HUD（2026-09-12）

`assets/ui/expedition/` 包含两张 192×192 透明模型头像和八张 40×40 原创线形 SVG（停止、集火、定位、集合、归航、食物、废料、装备）。来源和哈希见该目录的 `sources.json`。头像由 `art/capture_expedition_portraits.gd` 在 Godot 的离屏 SubViewport 中渲染当前用户提供的夏知遥/苏晚星 GLB；GLB 字节、比例和素材风格未改。此处缺正式 Expedition Portrait Asset，当前衍生头像可用于辨识，不冒充用户提供的独立头像插画。优先读取角色已有 portrait_path，空值时由角色模板 ID 选择衍生头像；运行实例 ID 不用作素材 ID。旧测试角色无模型头像时显示姓名首字。

六个技能继续使用原 100×100 正式图标；武器直接读取同期 WeaponDefinition.icon()。切角面板是共享的 Godot StyleBox 绘制，未导入 Deadly Days 图标、字体、颜色或 UI 贴图。屏幕适配与验收见 [外出视觉报告](../docs/EXPEDITION_VISUAL_REPORT.md)。

上述为 HUD 1 历史来源。当前正式 Expedition 已由下述 HUD 2.0 替换，旧头像回退与其他场景仍需的旧资源保留。

## Expedition HUD 2.0 正式素材

用户提供的基础包、v2、第二批 A、第二批 C 自动解压得到 54 张 PNG；六组同名文件内容不同，明确选择 v2，正式目录 `assets/ui/expedition_hud/` 共 48 张，按七类整理。源 ZIP 和 PNG 均按 SHA-256 保持原字节，没有重压、重绘或 AI 重生成；`.import` 由 Godot 生成。

六区 HUD 与 World UI 共用本套 PNG，文字、时间、HP 和搜索进度动态绘制。面板只取原边框，省去源图中固定示例条；原技能图标、武器图标与角色 portrait_path 保留。第二批 B 实际缺失，用户已同意用已提供的同义图标和按钮着色补位，未制造替代 B 包。

详细来源与全部 54 项见 [PNG 清单](EXPEDITION_HUD_PNG_LIST.md)、[哈希审计](EXPEDITION_HUD_ASSET_AUDIT.json)，具体替代、键位、原生截图和构建记录见 [HUD 2.0 接入报告](../docs/EXPEDITION_HUD_2_REPORT.md)。

2026-09-13 的 2.0.1 只使用运行时调色、Scale、Alpha 和布局精修；48 张 PNG 原字节保留。发光已烘焙在源图，Active 改用原 Default 外框配合动态小菱形，保留原 Active 文件。无光晕分层边框和普通地面细环仅列为未来素材建议，未擅自修改。参数与 A/B 证据见 [Visual Polish Report](../docs/EXPEDITION_HUD_2_0_1_VISUAL_POLISH_REPORT.md)。


## CAMP HUD 2.0（2026-09-13）

用户提供的 CAMP 三批 44 张 PNG 原件保存在 `assets/ui/camp_hud_2_0/source/`，逐张记录原分辨率、Alpha 多阈值边界和 SHA-256。运行副本按 Alpha ≥ 8 加 4 原生像素留边无损裁切，原比例、颜色和清晰度不改；050 只取纸框、空白纸纹与 Header，避免把示例 Gameplay Icon 和占位条作为真实内容。源目录有 `.gdignore`，运行图启用 Lossless 与 mipmaps。

主 UI 使用米白纸张、深蓝与青蓝高亮，统一 NinePatch 和 CampTextureButton 内容居中。正式 Logo、现有模型衍生头像、武器图标和道具/技能图标复用；缺少角色天赋独立图标时不借用系统 Icon。主验收保持 1920×1080，局部等比适配而不修改项目 Stretch / 3D Camera。完整映射见 [CAMP 素材表](CAMP_HUD_ASSET_MAP.md)、[审计 JSON](CAMP_HUD_ASSET_AUDIT.json)，交互、原生字形居中与构建状态见 [接入报告](../docs/CAMP_HUD_2_0_IMPLEMENTATION_REPORT.md)。

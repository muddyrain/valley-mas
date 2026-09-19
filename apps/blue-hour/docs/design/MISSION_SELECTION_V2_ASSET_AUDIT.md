# MISSION_SELECTION_V2_ASSET_AUDIT

2026-09-19。只读资产审计；唯一新增文件为本报告。未修改 UI、已有文件、命名、Scene、导入配置或 PNG；未启动引擎重新导入，也未生成新素材或联系表。

文件路径均相对于 `apps/blue-hour/`。素材表路径统一以 `assets/ui/` 为前缀。尺寸为原文件像素尺寸，不是屏幕尺寸。扫描目录包含 214 个 PNG、8 个 SVG；下表逐项展开本页全部直接图片及与目标相关的跨页面候选，非全部 222 个文件的逐像素质量认证。参考图、loading 整图、血条、肖像、技能/武器专用图片不因同在 UI 目录就列为任务页候选。

证据来自当前脚本/Scene/Resource 引用、Pillow 只读尺寸与 Alpha 极值检测、重点原图目视检查及用户提供的两张对照图。未重新运行 UI；“Runtime 引用”表示静态可达消费者，不代表本轮实机加载验证。动态加载核对了 `ui/expedition/hud_skin.gd` 的 alias/状态分支，不把文本检索无完整路径误判为未使用。

透明列 `A0–255` 表示 RGBA 且存在全透明/不透明像素；`A0–254` 表示没有完全不透明像素；这不证明边缘抠图洁净。透明处在图片查看器显示黑色，不代表源图烘焙黑底。源图的浅色轮廓、散点和阴影只能判为边缘检查风险，本轮不把它们未经复合检测就认定为背景污染。

## 页面实际装配与对照

| 文件 / 节点 | 当前用途与可达性 | 对素材判断的影响 |
|---|---|---|
| `core/main.gd::show_today_action()` | 在现有 Camp HUD 下实例化 `TodayAction.new()`，连接确认出发/取消 | 本页没有独立 `today_action.tscn`；主要节点由脚本生成 |
| `ui/today_action_screen.gd` | 全页布局、Atlas 裁切、按钮状态、动态文字、选中标识 | 所有“今日行动”、资源数字、任务名称、评级点和按钮文字均不需要重画成 PNG |
| `ui/camp_hud/camp_hud_root.tscn`、`ui/shelter_view.gd`、`scenes/camp/camp_main.tscn` | 父级 UI 和底层 3D Camp | 目标图的透景需求应先调整页面层，不需要生成一张假 Camp 背景 |
| `MissionSelectionBackground` | 1600×900 的运行时 GradientTexture2D；三个 Color 均 Alpha=1 | 当前 Camp 被完全遮住的直接原因之一；不是缺失背景资源 |
| `CampDimmer` | 全屏蓝灰 ColorRect，Alpha 0.46，入退场 tween | 已有可暗化后景的原生节点，无需遮罩 PNG |
| `MissionSelectionPageShell` | StyleBoxFlat；1448×872，Alpha 0.97，圆角和阴影 | 当前大块浅灰底来自代码；目标是纸卡与 Camp 透景，替换/调整是后续布局工作，不是必须补图 |
| `ui/new_run_art.gd` | 提供当前 `Art.LOGO`、字体和空按钮样式 | 当前 Logo 是 compact 版，不是 Camp 的彩色 Logo |
| `ui/menu_art.gd` | 本页使用 `theme()`；文件还 preload common 背景/纸板/按钮 | “被 helper 预载”不等于本页实际绘制该图片 |
| `ui/paper_card_hover.gd` | 卡片 Hover shader/动效；页面另建选中 rim | 当前 Hover/Selected 不缺基本实现；无需强制补整张状态 PNG |
| `data/today_actions/residential.tres`、`commercial.tres`、`airdrop.tres` | 三张缩略图和任务显示数据 | 任务类型不是缩略图上烘焙的字，可独立调整文案 |
| `ui/expedition/hud_skin.gd`、`ui/mission_hud.gd` | Expedition 动态资源映射与消费者 | 可跨页取图，但不能把 aliases 的名字当实际图形内容 |

**与用户图 1 / 图 2 对照：**

- 主差异是 Camp 可见度、纸张层级、卡片宽高比例、图标与文字排版。目标图并不要求当前的大块圆角浅灰 Panel，也不要求新背景 PNG。
- 三张场景插画与目标图内容一致，可保留；目标卡片底部是三组评价，现有卡片原图却烘焙四个方槽。这个缺口不能靠换三段动态文字消失。
- 当前底部横线经过正文，是 `today_action_selection_bar.png` 的固定横线与动态 Label 位置冲突。该横线不是 Godot 新绘制，也不是需要换字体。
- 当前卡片标题仍直接取 `action.display_name`，故图 1 保留“空投回收”；`_ui_title()` 只影响选中区。此前“整页已改名”的说法不准确。这是文字调用点问题，不是素材问题。
- 图 2 的商店、降落伞、日历、双人、箱子、菱形、行走/返回图标与手写点缀，不是当前任务底板自带。相近资源可筛选，未找到的不能虚报存在。
- 图 2 的近/中/远、物资箭头只作为参考信息结构；现有评级为脚本按 ID 写定，并非已证明的路程数值。此审计不把参考图文案视作玩法事实或实现授权。

## 本页原图与运行时裁切核对

| 资源 | 原尺寸 | Runtime 源区域 `(x,y,w,h)` | Reference 1600×900 下目标尺寸 | 结论 |
|---|---|---|---|---|
| today_action_board.png | 2075×698 | 全图 | 1380×460；NinePatch 四边 65 | 现有纸板确实已画出，不是背景缺失 |
| today_action_task_card.png | 984×1368 | 0,108,984,1260 | 350×448 | 大体保留比例；固定内嵌四槽限制 V2 排版 |
| today_action_status_bar.png | 2015×675 | 0,150,2015,327 | 1252×53 | 明显非等比压缩；分隔线与纸纹一同变形 |
| today_action_selection_bar.png | 2019×639 | 0,94,2019,423 | 1017×179 | 纸夹、相框、横线不可独立移动；照片另用 Polygon2D 动态贴入 |
| today_action_button_green.png | 1664×782 | 30,208,1558,350 | 288×69 | 可复用有效区域；不是整张纹理的尺寸 |
| today_action_button_red.png | 1605×826 | 0,224,1505,408 | 288×64 | 与绿按钮不同源比例，边框粗细需统一 |
| today_action_button_blue.png | 1451×711 | 153,172,1177,322 | 随 disabled 按钮 | 当前 disabled 换蓝底；非独立每按钮 Disabled 素材 |
| ui_common_logo_tagline_compact.png | 249×170 | 全图，KeepAspectCentered | 211×90 | 受高度限制实际图形约 132×90；不是拉伸但显得很小。浅灰底降低白字对比 |
| 三张 thumbnail | 见 A 表 | KeepAspectCovered | 292×130 | 有竖向裁切；图像主体应使用焦点构图，不应拉宽原图 |

以下只按 A / B / C 分组给出复用决定。N/H/P/S 分别为 Normal/Hover/Pressed/Selected。静态承载板/Logo/图标不需要这四态，只有它们作为可交互控件时才需父控件反馈。

## A. 直接复用

“直接”指无需改源图片，可用现有裁切、等比缩放、独立摆放或代码状态组合；不意味着图 2 能不改布局直接得到。

| 文件路径（前缀 assets/ui/） | 尺寸 | 透明通道 | 当前用途 / Runtime 引用 | 可直接复用 | NinePatch | N/H/P/S 是否需补 | 文字烘焙 / 背景污染 |
|---|---|---|---|---|---|---|---|
| `today_action/today_action_residential_thumbnail.png` | 628×438 | A0–255 | residential.tres → TodayAction | 是，住宅图 | 否，插画必须保比例 | 不需，状态放外层 | 无任务 UI 文字；街景本身不是污染 |
| `today_action/today_action_commercial_thumbnail.png` | 628×433 | A0–255 | commercial.tres → TodayAction | 是，商业图 | 否 | 不需 | 店铺招牌文字属于插画；无任务数据烘焙 |
| `today_action/today_action_airdrop_thumbnail.png` | 628×430 | A0–255 | airdrop.tres → TodayAction | 是，空投区域图 | 否 | 不需 | 无任务 UI 文案；不代表完整回收玩法 |
| `common/branding/ui_common_logo_tagline_compact.png` | 249×170 | A0–255 | Art.LOGO → 本页/NewGame | 是，小尺寸 Logo+标语，优先暗背景 | 否 | 不需 | Logo/英文/手写标语有意烘焙；无整块场景底 |
| `common/branding/ui_common_logo.png` | 249×107 | A0–255 | 当前检索无直接绘制引用 | 是，独立 Logo 候选 | 否 | 不需 | 品牌字属资产内容；勿当可本地化标题 |
| `common/branding/ui_common_handwritten_tagline.png` | 228×60 | A0–255 | 当前检索无直接绘制引用 | 是，独立标语；暗背景、原比例 | 否 | 不需 | 有意烘焙的手写字；不是正文容器 |
| `camp/m01/camp_logo_main.png` | 394×174 | A0–255 | camp_identity.tscn 已引用 | 是，跨页品牌备选；视觉比目标更彩色 | 否 | 不需 | 品牌与英文烘焙；无矩形背景 |
| `expedition/hud/final_match/expedition_logo_main.png` | 512×192 | A0–255 | HudSkin 的 logo_main 映射；消费者需按使用点区分 | 是，较高分辨率品牌备选，不替代确认尺寸 | 否 | 不需 | 品牌文字有意烘焙；透明周边 |
| `route_selection/route_selection_tab_tape.png` | 39×41 | A0–169 | Art.TAB_TAPE → NewGame 页签 | 是，浅蓝半透明胶带，适合原尺寸小装饰 | 否 | 可由 S 控制显隐，无需四张 | 无文字；半透明设计，不能当不透明贴纸 |
| `route_selection/route_selection_title_divider_left.png` | 51×15 | A0–255 | Art 常量/开局页装饰资源 | 是，标题左线备选 | 仅横向保护端点 | 不需 | 无文字；不是背景 |
| `route_selection/route_selection_title_divider_right.png` | 52×15 | A0–255 | 同上 | 是，标题右线备选 | 仅横向保护端点 | 不需 | 无文字 |
| `common/icons/ui_common_confirm_arrow_icon.png` | 32×40 | A0–255 | Art.CONFIRM_ARROW → 开局按钮 | 是，确认右箭头 | 否 | 父按钮反馈，无需单独补 | 无文字/整块底 |
| `common/icons/ui_common_small_arrow_icon.png` | 24×32 | A0–255 | Art.SMALL_ARROW | 是，小箭头，避免放大 | 否 | 不需 | 无文字/整块底 |
| `common/icons/ui_common_camp_icon.png` | 80×80 | A0–255 | Art.ICON_TENT → 开局页 | 是，营地语义候选 | 否 | 不需 | 无字；不是目标的回转箭头 |
| `camp/m03/m03_icon_food.png` | 64×64 | A0–255 | Camp ResourceBar 引用；本页未接 | 是，罐头食物图标 | 否 | 不需 | 无字；彩色罐头，不是目标纯蓝版本 |
| `camp/m03/m03_icon_scrap.png` | 64×64 | A0–255 | Camp ResourceBar 引用；本页未接 | 是，齿轮废料图标 | 否 | 不需 | 无字；图形比 Expedition 废料堆更接近目标 |
| `camp/m02/m02_icon_sun_day.png` | 64×64 | A0–255 | Camp time_status.tscn | 是，白昼辅助图标 | 否 | 不需 | 无字；太阳不等同日历，不冒充目标日历 |
| `expedition/hud/icons/actions/icon_house_small.png` | 237×236 | A0–255 | HudSkin 映射/POI 图标链 | 是，住宅语义 | 否 | 不需 | 无字；白边立体感可接受时直接用 |
| `expedition/hud/icons/actions/icon_house_large.png` | 428×395 | A0–255 | HudSkin 映射/POI 图标链 | 是，大型建筑语义 | 否 | 不需 | 不等同商店棚檐图标，不能强行改语义 |
| `expedition/hud/icons/actions/location_pin_micro.png` | 144×182 | A0–255 | MissionHUD discovery → HudSkin | 是，距离/位置 | 否 | 不需 | 无字；不同色可走控件着色但非此轮 |
| `expedition/hud/icons/actions/arrow_right.png` | 184×161 | A0–255 | HudSkin 映射 | 是，较大箭头备选 | 否 | 不需 | 无字；需按有效内容框布置 |
| `expedition/hud/icons/actions/search_time_clock.png` | 186×214 | A0–255 | HudSkin icon_search 映射/POI | 是，时间语义候选 | 否 | 不需 | 无字；不能当日历日期 |
| `expedition/hud/icons/resources/icon_food.png` | 322×332 | A0–255 | MissionHUD icon_bag 与 Camp ResourceBar | 是，沿用现有 Expedition 物资风格 | 否 | 不需 | 无任务文字；风格为彩色物件，非目标单色剪影 |
| `expedition/hud/icons/resources/icon_scrap.png` | 377×309 | A0–255 | MissionHUD icon_loot 与 Camp ResourceBar | 是，废料堆语义 | 否 | 不需 | 无字；复杂物件小尺寸识别逊于齿轮 |

其他可直接复用的非 PNG 能力：`paper_card_hover.gd` 的透明轮廓 Hover、页面现有选中 rim、Godot Label/StyleBox 的“已选择”徽标、圆点评级、分隔线与动态标题。均不应为了匹配目标截图烘焙文字或强制生成 N/H/P/S 整卡图片。运行时 Camp 3D 背景也已存在，缺的是正确透景合成。

## B. 需要轻微处理

“处理”可只是后续 Atlas 区域、NinePatch 安全边距、布局比例或材质配置；需要编辑图片的项目在备注明确写出。本轮未进行这些操作。

| 文件路径（前缀 assets/ui/） | 尺寸 | 透明通道 | 当前用途 / Runtime 引用 | 可直接复用 | NinePatch | N/H/P/S 是否需补 | 文字烘焙 / 背景污染 / 最小处理 |
|---|---|---|---|---|---|---|---|
| `today_action/today_action_board.png` | 2075×698 | A0–255 | 本页 CARD 区大纸板，实际 NinePatch | 原风格可用；V2 需校边距 | 是，已有 65px，但内框距边不全落在 65 内，应重新测安全区 | 静态不需 | 无字；撕边有零碎亮点/彩边风险，深浅底需验证。叠纸效果可用同源多层，不必重画 |
| `today_action/today_action_task_card.png` | 984×1368 | A0–255 | 本页三卡底图 | **不能无处理当 V2 自由卡片** | 整图不适合：标题槽、照片槽、三行、四方槽会被拉伸 | N 已有，H/S 用代码；P 可轻微压暗，无须新整图 | 无文本，但四统计槽/横线/凹槽全部烘焙。可清理下方四槽或改用 common_card_paper 组合；这属轻量修底，不是必须整卡生成 |
| `today_action/today_action_status_bar.png` | 2015×675 | A0–255 | 本页顶部条 | 有效区域可用，需修比例 | 有条件；两条固定分隔线不应穿伸缩中段 | 不需 | 无字；三列分隔线烘焙，当前被纵向压扁。可保留固定三列，或拆分隔线后动态布局 |
| `today_action/today_action_selection_bar.png` | 2019×639 | A0–255 | 本页 briefing + 相框 + 纸夹 | 相同比例可用，变宽需处理 | 整体否；拆成左装饰与右纸面后可 | 不需 | 无正文，但纸夹/相框/灰照片底/横线烘焙。照片是动态 Polygon2D 覆盖；不能拉伸纸夹。正文与横线相交先修布局，非必须重画 |
| `today_action/today_action_button_green.png` | 1664×782 | A0–255 | 本页确认 | 保留有效 Atlas；统一按钮内容框 | 裁切后可，需保护斜角与双边框 | N 已有；H/P 当前亮暗调制，S 不适用；只有要求独立高光时才补图 | 无按钮文字；大透明边，绿色毛边/阴影需复合检查；无需烘焙“确认出发” |
| `today_action/today_action_button_red.png` | 1605×826 | A0–255 | 本页返回 | 同上；与绿底有效比例不同 | 裁切后可 | 同上 | 无文字；红边是材质/阴影或边缘残留，不能未经检查判全图污染 |
| `today_action/today_action_button_blue.png` | 1451×711 | A0–255 | 本页按钮 disabled 底 | 可保留，校正与 N/H/P 共同内容框 | 裁切后可 | N 底已有；disabled 调制已有；不需要 Selected | 无字；不应让禁用切换改变几何或边框比例 |
| `common/panels/ui_common_paper_panel.png` | 2172×724 | A0–255 | MenuArt.paper/dialog_paper；本页只用其 theme | 是候选，需 Atlas/边距 | 是；MenuArt 已有 dialog_paper 72/48 安全边距用法，不能盲套其他裁切 | 不需 | 无字、无场景底；有厚斜角框，目标撕纸感略有区别 |
| `common/cards/ui_common_card_paper.png` | 300×336 | A0–255 | 未见当前直接引用 | 是空白卡替代，需组合内层内容 | 适合保护边缘的小幅扩展；纹理大幅放大变软 | 父控件 H/P/S 即可 | 无字/固定栏位；比当前四槽卡更自由，但分辨率较低 |
| `common/cards/ui_common_card_background.png` | 300×336 | A0–255 | NewGame CARD_COMPOSITE 已用 | 需确认复合结构再用，不优先于空白 paper | 复合整图不推荐 | 原父卡逻辑有状态 | 不把 composite 当纯纸；不可按文件名承诺无内嵌装饰 |
| `common/cards/ui_common_card_name_strip.png` | 189×56 | A0–255 | 未见当前直接引用 | 标题条候选，需尺寸校验 | 仅横向保护端点 | 不需 | 小图，大幅放大需谨慎；本轮未逐像素确认细节 |
| `common/cards/ui_common_card_brush.png` | 261×169 | A0–255 | 未见当前直接引用 | 局部笔刷装饰候选，需选区 | 否 | 不需 | 不用作整页背景；本轮未逐像素确认细节 |
| `route_selection/route_selection_board_panel.png` | 1158×464 | A0–255 | NewGame Art.BOARD | 纸板备选，需与现有板比较厚度/比例 | 有条件，先保外缘 | 不需 | 不是本页当前 BOARD，不可混淆引用 |
| `camp/m01/camp_identity_panel_bg.png` | 1599×984 | A0–255 | camp_identity.tscn | 不宜原样替整页；仅可评估局部纸面 | 复合身份板整图不推荐 | 不需 | 模块构图不等同目标主板；非必须素材 |
| `camp/m02/m02_status_bar_bg.png` | 1136×152 | A0–255 | time_status.tscn | 可换公共条，需匹配列宽 | 有条件，固定分隔线需保护 | 不需 | 无字，纸面+两条分隔线；比当前 2015×327 更接近长条比例 |
| `camp/m03/m03_resource_chip_bg.png` | 206×112 | A0–255 | resource_bar.tscn | 日期/资源小纸片候选，需比例测试 | 小幅可；不能替 1252px 整条 | 不需 | 独立资源底，不是目标整页板 |
| `camp/m03/m03_menu_button_bg.png` | 232×112 | A0–255 | resource_bar.tscn | 小按钮候选，非绿色主 CTA | 保角可 | H/P 可调制，S 不适用 | 无需生成文字；目标配色不一致 |
| `expedition/hud/panels/hud_day_panel_bg.png` | 156×51 | A0–255 | MissionHUD day_panel → HudSkin | 日期角标候选，需去小字号放大风险 | 是，现有使用 Vector4(16,10,16,10) | 不需 | 空白纸面有蓝边/小装饰，无日期数字烘焙 |
| `expedition/hud/panels/hud_resource_card_bg.png` | 112×48 | A0–255 | HudSkin hud_resource_* 动态解析，不能仅此认定当前绘制 | 小资源片候选，需验证消费者/比例 | 仅小幅，原图很小 | 不需 | 不宜放大作全页板；本轮未逐像素确证纹理 |
| `route_selection/route_selection_confirm_button_normal.png` | 193×84 | A0–255 | NewGame Art.BUTTON_CONFIRM | 绿色替代，但目标为斜角长按钮，本图更圆 | 有条件，保持圆角 | N 有，H/P 可代码，S 不适用 | 无字、透明底；尺寸较小，不能比高分辨率 TodayAction 底更优先 |
| `route_selection/route_selection_cancel_button_normal.png` | 140×57 | A0–255 | NewGame Art.BUTTON_CANCEL | 返回按钮备选，避免大幅放大 | 有条件 | N 有，H/P 可代码，S 不适用 | 与当前 TodayAction 不是同一规格 |
| `common/buttons/ui_common_blue_button_normal.png` | 2172×724 | A0–254 | MenuArt.button | 深蓝按钮备选，需裁有效区域 | 是，需保护轮廓 | N 有，H/P 调制已有 | 无需按钮文字烘焙；原图周围透明留白较多 |
| `expedition/hud/buttons/hud_return_button_default.png` | 1020×283 | A0–254 | HudSkin hud_return_default → Expedition 返回按钮 | 与目标绿色按钮非同一视觉，按备选评估 | 可，依皮肤裁切/边距 | N 有 | 不直接替换绿色 CTA；需保内部比例 |
| `expedition/hud/buttons/hud_return_button_hover.png` | 1020×283 | A0–254 | HudSkin 真实 hover 分支 | 与 default 成套候选 | 同 default | H 有 | 同套 N/H/P 几何一致 |
| `expedition/hud/buttons/hud_return_button_pressed.png` | 1020×283 | A0–254 | HudSkin 真实 pressed 分支 | 与 default 成套候选 | 同 default | P 有 | 同上 |
| `expedition/hud/buttons/hud_return_button_active.png` | 240×88 | A0–255 | hud_return active 实际回退 default；此旧文件未走该映射 | 否，不直接混进上述三态 | 需先规范几何 | 不能把 Active 文件当现成 Selected | 不同尺寸/视觉世代，当前映射避开它 |
| `expedition/hud/buttons/hud_return_button_disabled.png` | 240×88 | A75–250 | hud_return disabled 实际回退 default；旧文件不由该分支加载 | 否，不直接混套 | 需先规范几何 | disabled 可沿用代码调制 | **整幅均非全透明，背景会叠成矩形**；与 N/H/P 非同套尺寸 |
| `expedition/search/search_cancel_normal.png` | 96×32 | A0–255 | search_card.gd | 只能小型取消按钮复用，不适合大 CTA | 不建议放大 | N 有，P 可调制，S 不适用 | 搜索专用，文字/边缘细节需专项确认，不拿来替换大返回按钮 |
| `expedition/search/search_cancel_hover.png` | 96×32 | A0–255 | search_card.gd | 与 normal 同尺寸小按钮备选 | 同上 | H 有 | 不能据此认为 TodayAction 缺 Hover PNG |
| `expedition/hud/feedback/misc_decorations.png` | 923×338 | A0–255 | 未找到正式消费者，来源 manifest 不算 Runtime | 需 Atlas 拆分；本页不优先 | 单片可评估，整图否 | 不需 | 无字；是科技描边/星形合集，**不是纸夹/纸胶带合集** |
| `common/branding/ui_common_logo_tagline.png` | 1774×887 | A0–255 | TitleScreen/MenuArt | 高分辨率 Logo 备选，需裁切与小字号标语处理 | 否 | 不需 | 品牌/标语有意烘焙；边缘碎点较多，不能把它当 compact 的纯高清等价版本 |
| `expedition/icons/food.svg` | 40×40 viewBox | 透明 SVG，无底形 | 当前 UI 未检索到该目录直接消费 | 可作为旧线稿备选，需调色 | 否 | 不需 | 苹果线稿，非目标罐头 |
| `expedition/icons/scrap.svg` | 40×40 viewBox | 同上 | 同上 | 形状实际是箱子，可作“物资箱”候选，需正确语义/调色 | 否 | 不需 | 无字；不因文件名就当齿轮 |
| `expedition/icons/return.svg` | 40×40 viewBox | 同上 | 同上 | 返回营地语义可用，需调色 | 否 | 不需 | 房屋+返回线，不是目标纯回转箭头 |

不建议跨页硬用的候选：`route_selection_title.png`（476×56、A0–255）是开局页特定标题图，引用于 Art.ROUTE_TITLE，不能替“今日行动”；`common/backgrounds/ui_common_background.png`（1919×1080、RGB 无 Alpha，MenuArt.BACKGROUND）是整张菜单背景，不能充当透明遮罩；`expedition/hud/icons/actions/icon_home.png`（48×48、A0–255）实际是房屋，虽被 `icon_team` 别名用在集合按钮，也不是目标双人图标；`expedition/hud/icons/phases/icon_phase_warning.png`（64×64、A0–255）实际是金色星形，不是目标叹号盾牌。上述均不适合 NinePatch，不需要补四态来解决语义错误。

Camp M06 按钮是方形技能模块，已有专用 hover glow；它不是本页长 CTA 的缺口解决方案。Expedition 肖像、血条、minimap、Loading 整体构图也不列为目标页面可直接复用资产。

## C. 必须重新生成

**当前没有已证实“必须重新生成 PNG”才能达成页面结构目标的项目。** 纸底、按钮、缩略图、Logo、胶带和选中光效已有来源；四槽底图可以轻修或用已有空白纸拼装，不需要整套推倒。目标图不能证明新图一定必要。

若后续要求严格复刻目标图的图标语言，存在以下待补设计缺口，但应先允许原生矢量/现有图形组合，不应直接升级为 AI 生成素材任务：

| 目标缺口 | 现有文件路径 / 尺寸 / Alpha | 当前引用 / 可直接复用 | NinePatch / 四态 | 文字与背景要求 | 判断 |
|---|---|---|---|---|---|
| 商店棚檐图标、降落伞图标 | 未确认有对应独立资产；尺寸/Alpha 不适用 | 未确认可用 Runtime 图形 | 否；静态无需四态 | 不含标题/纸底 | 当前房屋/插画不能冒充；若严格要求同形，需补小型矢量图形，不一定 PNG |
| 双人外勤、日历、菱形高价值、风险盾牌 | 未确认有目标同形资产 | icon_team/phase_warning 名称容易误导，不可直接用 | 否；静态无需四态 | 不含资源数字/日期 | 可用代码/矢量，未达到“必须生成图片”的结论 |
| 独立纸夹/相框分层 | 独立文件未确认；组合在 `today_action_selection_bar.png`，2019×639，A0–255 | 合成图当前已用，保持比例可复用 | 纸夹否；拆分纸面可 | 灰照片底和横线需与动态内容解耦 | 只有要任意重排时需拆分/补局部，不是必须重新生成整块 briefing |
| 目标右侧手写装饰句、左右页脚手写文字 | 未确认同句独立文件 | 现有 tagline 文案不同 | 否；无需四态 | 文字应优先字体实时绘制，不把目标图字抠成 UI 数据 | 装饰可省略；不构成必须生成的素材缺口 |

本轮结论只用于审阅复用与缺口：A 优先沿用、B 后续按明确比例/裁切/分层处理、C 暂无强制重生图清单。不执行改图、重命名、UI 接入或目标图实现。

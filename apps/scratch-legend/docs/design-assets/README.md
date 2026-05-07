# Scratch Legend 设计资产

本目录存放刮出传说（Scratch Legend）的玩法视觉参考、UI 草图和后续实现截图。

---

# 当前蓝图设计

## `v1-gameplay-overview.png`

用途：

* 作为当前正式玩法蓝图设计。
* 帮助理解前期、中期、后期各系统在同一游戏中的关系。
* 提供像素风、深色面板、木桌、盘子、电话、刮刮卡、金币等奖励图标的风格方向。
* 指导阶段拆分：前期洗盘子赚启动金，阶段二进入第一张安全卡，随后进入风险卡、成长系统、自动化与 Prestige。

与《刮个爽》玩法对齐点：

* 前期通过日常工作 / 刮盘子获得基础资金。
* 阶段二通过第一张安全卡建立“买卡 -> 拖动刮开 -> 结算”的主循环。
* 中期通过风险卡与 Peek 机制建立“继续刮还是止损”的判断。
* 后期通过更多卡类、升级、自动化、高风险卡、终局卡和 Prestige 拉长成长线。
* 图中的“成为传说”按 `scratch-legend-design.md` 中的 Prestige 永久成长方向理解。

使用边界：

* 它是当前蓝图设计，不是逐像素 UI 还原稿。
* 当前开发阶段不能因为该图展示了中后期内容，就提前实现风险卡之后的升级、自动化、高风险卡、终局卡或 Prestige。
* 阶段 0 / 阶段 1 只参考图中的 `1.1 刮盘子界面`、`1.2 结算界面`、`1.3 工作面板`。
* 图中的数值仅作展示，真实数值以 `scratch-legend-design.md` 为准。

---

# 后续资产命名建议

如果后续需要更细页面稿，建议使用：

```txt
v1-start-work-screen.png
v1-cleaning-plate-screen.png
v2-basic-scratch-card-screen.png
v3-upgrade-panel.png
v4-auto-scratch-screen.png
```

新增资产后，需要在本 README 中登记用途和适用阶段。

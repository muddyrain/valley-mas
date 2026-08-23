# P2 湿热生境视觉切片

> 当前状态：P2-1 已由用户在 Web 地图中验收通过；这些资源仍是可替换 prototype，不是最终正式美术。

## 固定验收场景

- 世界：`continent`
- Seed：`0x1a2b3c4d`
- 雨林海岸：chunk `146`
- 湿地泥岸：chunk `201`
- 运行时 catalog：`p2-wet-hot-1`

固定镜头由 `P21AcceptanceScene` 提供。进入世界后可直接使用左上角开发调试栏的“雨林 / 湿地”按钮切换验收场景；底层仍通过 `map-focus-p2-1` 事件选择 `rainforest` 或 `wetland`。镜头只定位已有地图事实，不修改生成结果。

## 本轮资源

- 雨林：4 类树型，覆盖幼树、成熟、老树和紧凑、标准、高树组合；使用深绿宽叶、层叠冠形和可读树干。
- 湿地：3 类树型，覆盖相同年龄/高度纪律；使用浅灰绿冠、根脚和偏水生轮廓。
- 地表：雨林植被土、湿地泥地、低频 `16×16px` 材质组和稀疏 `4×4px` 语义覆盖。
- 林下/岸边物件：蕨、苔藓、菌菇、芦苇、灌木，以及既有石块、枯木和岸边碎屑语义。
- 生境边缘：`4–12` 世界格视觉桥接，权威 biome 不变。

所有 atlas 都由 `pnpm assets:p2` 确定性生成至 `public/map/p2/`。正式 tileset 未来可按相同 manifest、帧尺寸和语义 ID 整体替换，不需要重写 `WorldGenerator` 或地图投影算法。

## 验收证据

- Contact sheets：`output/p2-1-acceptance/contact-sheets/`
- 浏览器截图与状态：`output/p2-1-acceptance/browser-smoke/`
- Ground-only 高频边缘率：雨林 `2.21%`、湿地 `3.38%`，门禁上限 `5%`
- 浏览器链路：template → loading → world → 雨林/湿地区域 → close LOD

P2-1 已于 2026-08-23 关闭。后续干燥生境证据独立记录在 [`../p2-2/`](../p2-2/)；P2-1 目录继续作为湿热生境回归基线。

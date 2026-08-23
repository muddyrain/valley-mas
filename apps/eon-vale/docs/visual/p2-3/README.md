# P2-3 寒冷生境验收记录

状态：已实现，等待用户 Web 视觉验收。P2-4 未开始。

固定输入为 `continent + seed 8`：

- chunk `36`：苔原、雪地与海岸；
- chunk `24`：极地、冰地与冰岸；
- chunk `38`：真实寒冷高地/山地关系。

运行时 catalog 为 `p2-cold-1`，PNG 位于 `public/map/p2-3/`。浏览器证据位于
`output/p2-3-acceptance/browser-smoke/`，contact sheet 位于
`output/p2-3-acceptance/contact-sheets/`。

本阶段使用可替换 prototype assets。正式素材可重绘或重新打包 atlas，但必须保留 manifest
约束的语义 ID、尺寸族、源画布、锚点、逻辑占地、净空、渲染层、shadow/LOD 引用与动画状态。
atlas 页、帧坐标、文件名、轮廓和 palette 值不是世界生成事实。

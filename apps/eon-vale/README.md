# Eon Vale · 纪元谷

Eon Vale 是一个浏览器单机 2D 像素神明沙盒。玩家可塑造地形、投放生物、观察居民成长并形成村庄与王国，再用十六种神力干预生态、经济、外交和战争。

## 启动

```bash
pnpm --filter @valley/eon-vale dev
```

打开 `http://127.0.0.1:5184`。拖动平移地图，滚轮按固定倍率在世界、聚落和居民三级视角间缩放；从底部工具栏选择地形、生物或神力，再点击地图施放。双击居民可进入近景跟随，顶部人口数字可展开出生、死亡、迁徙、承载力和年龄结构，底部可暂停并切换 `1×/2×/4×/8×` 时间倍率。

新世界支持 128、256、384 三种尺寸，以及群岛、主大陆、空白海洋三种形态。阶段 0 压测可直接使用设置面板的 100、500、1000 居民入口，也可打开 `?stress=1000`。性能面板展示 FPS、P95 帧时间、模拟 Tick、寻路队列、批次估算 Draw Calls 和三角形数。

树木、露天石料和金属矿脉是可采集、可悬停查看的独立节点。居民会按村庄需求预留节点、采集、携带并送回仓库；建筑要经历清障、分批运料和施工，矿场只能建在有限矿脉附近。资源和地图运行时都使用增量同步，不会每秒整图重绘。

V5 世界档案存入独立的 IndexedDB 命名空间，提供三个手动档、三个滚动自动档，并支持 JSON 导入导出。项目尚未上线，旧开发期档案按当前产品决策不做迁移。

## 校验

```bash
pnpm --filter @valley/eon-vale check
pnpm --filter @valley/eon-vale typecheck
pnpm --filter @valley/eon-vale test
pnpm --filter @valley/eon-vale build
pnpm --filter @valley/eon-vale benchmark
pnpm --filter @valley/eon-vale test:e2e
```

产品状态、性能基线和架构说明见 [docs/PLAN.md](./docs/PLAN.md)。

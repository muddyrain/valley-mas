# Ambient Forge

Ambient Forge 是一个程序化生成的 3D 环境场景。v0.1 聚焦一座随本地时间、模拟天气和本地音乐平滑变化的浮空岛。

## 启动

```bash
pnpm --filter @valley/ambient-forge dev
```

默认地址：`http://127.0.0.1:5181`。

## 验证

```bash
pnpm --filter @valley/ambient-forge test
pnpm --filter @valley/ambient-forge typecheck
pnpm --filter @valley/ambient-forge check
pnpm --filter @valley/ambient-forge build
```

## 隐私与浏览器能力

- 本地音乐只在当前页面内解码和播放，不上传、不写入本地存储。
- 设置使用带版本校验的 `localStorage`，不包含文件内容或 Object URL。
- 环境声开关会保存，但页面刷新后仍等待下一次用户交互才恢复音频节点，遵守浏览器自动播放限制。
- 视频导出优先选择浏览器真实支持的 WebM 编码；音频轨不可组合时明确降级为无声 WebM。
- `?debug=1` 显示 FPS、DPR、天气、粒子数和三频能量。

产品范围、阶段与验收状态见 [`docs/PLAN.md`](./docs/PLAN.md)。

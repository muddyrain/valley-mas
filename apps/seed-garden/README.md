# 语种园 · Seed Garden

AI 驱动的网页放置挂机小游戏。详见：

- 设计文档：[docs/superpowers/specs/2026-06-16-seed-garden-design.md](../../docs/superpowers/specs/2026-06-16-seed-garden-design.md)
- 实施计划：[docs/superpowers/plans/2026-06-16-seed-garden-plan.md](../../docs/superpowers/plans/2026-06-16-seed-garden-plan.md)
- Prompt 模板：[docs/superpowers/specs/seed-garden-prompt-v3.2.md](../../docs/superpowers/specs/seed-garden-prompt-v3.2.md)

## 启动

```bash
cp .env.example .env.local
cd ../.. && pnpm install
cd apps/seed-garden && pnpm dev
```

后端：

```bash
cd ../../server && go run ./cmd/server
```

启动后访问 <http://localhost:5180/garden> 查看占位页。

## 资产生产流程

1. 使用 ChatGPT Pro（GPT Image 1）按 `docs/superpowers/specs/seed-garden-prompt-v3.2.md` 出图。
2. 命名 `<concept_key>_<stage>.png`（如 `monday_morning_3.png`）。
3. 放入 `public/assets/encyclopedia/<rarity>/`（rarity ∈ {N, R, SR, SSR}）。
4. 同步更新 `public/assets/encyclopedia/manifest.json` 与 `server/internal/garden/assets/manifest.json`。

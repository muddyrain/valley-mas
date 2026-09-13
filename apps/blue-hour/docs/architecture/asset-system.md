# 资源生命周期

```text
创建 → 导入 → 正式接入 → Asset Manifest → 更新 → 废弃 → Archive → Delete
```

- 创建：源文件进入 `art/` 或资源源目录，记录来源与用途。
- 导入：让 Godot 生成 `.import` 与 UID；不人工伪造内部 UID。
- 正式接入：由 `data/`、场景或脚本建立引用。
- Manifest：在 `docs/development/asset-audit.json` 与 `docs/architecture/asset-manifest.md` 登记 Asset ID、路径、状态和备注。
- 更新：先确认引用，再替换资源；旧版本通过 Git 保留。
- 废弃：静态、配置和动态引用均确认后标记 `ARCHIVE` 或 `UNKNOWN`。
- Archive：移动到 `assets/_archive/` 或 `docs/archive/YYYY-MM/`，保留来源和迁移日期。
- Delete：只有通过无引用、无动态风险、替代资源存在、Godot 扫描与启动验证后才允许分批删除。

`assets/generated/` 属于自动生成边界，默认保留；正式运行时不得直接依赖未登记的中间产物。

# 资源身份与绑定契约

Survivor 使用 `survivor_id` 作为身份键。Model、Portrait、Animation 和 Data 经 SurvivorDefinition 关联；文件名、中文名、数组位置、目录或创建顺序不表达身份。

- 正式模型与头像归 `assets/characters/<character_id>/`；方形头像为该角色 `portrait/avatar_square.png`，由 Definition 的 `portrait_path` 引用。
- 公共移动动画复用 `assets/animations/public_locomotion/`，角色目录不复制公共动作。旧 `assets/ui/camp/survivor_avatars/` 仅保留弃用说明。
- UI 消费 Survivor 与 ID 关联的 view model，不扫描目录生成绑定，不用旧截图、旧资源或临时 fallback 覆盖正式数据。
- 资源变更先核对来源、ID、使用位置和绑定链路；图片保留来源记录。更新数据字段同时核对目录校验、消费模块与规则测试。
- 模型可替换，战斗、导航、资源和结算不依赖具体占位模型节点。保留 source/runtime/legacy 的流水线边界，资源删除与迁移核对动态引用。
- 代码、场景和 Runtime Asset 使用稳定业务名；业务编号、规格编号与 LOD/Asset ID 有语义，版本或开发历史后缀交给 Git。

数据入口：[Definition](../../data/survivor_definition.gd)、[角色定义](../../data/survivors/)、[内容目录](../../data/catalog.gd)。美术路径与工具见 [资源布局](../../art/RESOURCE_LAYOUT.md)、[流水线](../../art/ASSET_PIPELINE.md)；正式资源的选择还需遵循 [环境复用边界](environment-reuse.md)。

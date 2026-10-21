# 角色设计

角色定义位于 `data/survivors/*.tres`，由 Registry 统一注册。成员使用稳定 ID，运行时模型路径由 Definition 提供；角色参与开局、Roster、模型和测试的范围由 Definition 与当前注册数据确定，不从旧报告中的角色数量推断。

角色的职业、Trait、等级、生命和装备由 Campaign 持有；不要按内容目录或数组位置恢复成员身份。

模型、头像与公共动画绑定见 [资源身份](../architecture/resource-binding.md)，完整角色内容表保留在 [历史内容表](../archive/2026-10/stages/SURVIVOR_DATA_TABLE.md)，具体数值以当前 Resource 为准。

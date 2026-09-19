# Canonical Public Locomotion Library V1

本轮已使用通过验收的 Standard `idle.tres / walking.tres / running.tres` 做一次公共离线转换。新增唯一公共 [Library](../assets/animations/public_locomotion/public_locomotion.tres) 及三份 `public_*` 动作，时长保持14 / 1.0416667 / 0.6666667秒，未接入正式角色或 Gameplay。

**Canonical技术与参考鞋底QA通过；Xia / Su动态蒙皮FAIL；不满足生产放行条件。**统一Authoring Reference恢复Standard实际摆臂后，现有A Pose Mesh与T Pose Rig的绑定位置仍造成袖臂进入躯干。鞋前掌Push Off也有约17–22mm离地残差。不能通过更改公共动作姿态掩盖绑定问题。

- [完整映射、Rest-space说明、测量与边界](../test-output/canonical-public-locomotion/REPORT.md)
- [36段原生视频与阶段图](../test-output/canonical-public-locomotion/index.html)
- [独立Windows验收程序](../test-output/canonical-public-locomotion/build/CanonicalLocomotionReview.exe)
- [复现脚本](../art/blender/scripts/canonical_locomotion/reproduce.ps1)
- [来源与验收状态](../assets/animations/public_locomotion/provenance.json)

没有修改Standard源、Xia/Su候选或正式Mesh/Skin/Skeleton、旧Retarget、旧公共库或Gameplay速度。保护快照258项中257项不变；唯一变化为并行工作中的`missions/mission.gd`，本任务未写入或回退该文件。主计划不登记功能完成，本轮是隔离候选与验收证据交付。

下一步建议先处理统一Bind Pose / Skin Alignment及Foot/Toe鞋底支点，再用同一份公共库复验；本轮不执行绑定修改，不扩展Combat/Armed或其他Survivor。

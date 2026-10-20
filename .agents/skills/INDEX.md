# 仓库技能

普通开发从局部 AGENTS 进入；以下技能只在对应任务中使用，不组成固定前置流程。

| 技能 | 使用条件 |
|---|---|
| `encoding-guard` | 实际修改中文、非 ASCII 或批量文本时定向检查 |
| `documentation-freshness-audit` | 用户明确要求文档事实审计或代码与文档对齐 |
| `web-performance-review` | 用户明确要求 Web 性能审阅 |
| `conventional-commit-guard` | 用户要求生成提交信息或执行提交，按授权区分行为 |

通用设计、GSAP、Godot、GitNexus 与访谈参考在个人技能中手动选用，仓库不维护重复副本。汇报与完成要求由根 AGENTS 负责，UI 约束由各应用维护。

新增或移除技能时同步本索引并运行 `pnpm check:harness`；嵌套技能同样纳入检查。

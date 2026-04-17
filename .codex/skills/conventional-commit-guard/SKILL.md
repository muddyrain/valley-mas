---
name: conventional-commit-guard
description: 在 Valley MAS 中编写符合 Conventional Commits 规范的提交信息。适用于需要生成、整理或检查 git commit message 的任务。
category: general
---

# Conventional Commit 护栏（强约束版）

当任务涉及编写或建议 `git commit message` 时，使用这个技能。

## 目标

让提交信息默认符合 Conventional Commits，并与仓库既有风格一致。

## 强制执行规则（Agent 必须遵守）

1. 在生成 commit message 前，先查看最近提交风格（至少 5 条），避免风格漂移。
2. 首行必须是 Conventional Commits：
   - `type(scope): summary`
   - 或 `type: summary`
3. `summary` 默认使用中文，短句、明确、可读，不写空泛词。
4. 默认提交信息**只写一行首行**，不自动附加长正文、解释段落或 trailers。
5. 只有在用户明确要求（例如“写详细 commit message / 带 Lore trailers”）时，才允许写正文与 trailers。
6. 生成 message 后，先自检再提交：格式、语义、长度是否符合“短 message”要求。

## 失败处理（Agent 必须执行）

- 若提交被 hook 拒绝，不允许只说“已失败”；必须立刻修正 message 并重提。
- 若用户指出风格不一致，必须优先对齐仓库历史风格并 `amend`，而不是解释原因。
- 若用户指出“太长”，必须改成短提交首行并优先 `amend` 修正历史。

## 长度约束（默认）

1. 仅保留首行：`type(scope): summary` 或 `type: summary`。
2. `summary` 建议控制在 18 字以内（中文），避免逗号连接多动作。
3. 一个提交只表达一个主动作，避免“并列句 + 解释句”。

## 默认格式

```text
type(scope): summary
```

如果不需要 `scope`，可以使用：

```text
type: summary
```

## 当前默认偏好

- `type` 和 `scope` 保持 Conventional Commits 常见写法
- `summary` 默认优先使用中文
- 中文 summary 要短、准、直接，不要写成长句

例如：

- `feat(image-text): 支持局部文字字号设置`
- `fix(blog): 修复作者访问私密博客 404`
- `docs: 更新站点为个人网站定位`

## 常用类型

- `feat`: 新功能
- `fix`: 修复问题
- `refactor`: 重构但不改变功能
- `chore`: 杂项维护、配置、脚本、小调整
- `docs`: 文档改动
- `style`: 纯样式或格式调整
- `test`: 测试相关
- `perf`: 性能优化
- `build`: 构建、打包、依赖、发布流程
- `ci`: CI/CD 相关

## 编写规则

1. `summary` 默认使用中文短句。
2. 总结改动结果，不要写成过程描述。
3. 优先写“做了什么”，不要写“我改了什么”。
4. 如果改动明显属于某个模块，补上 `scope`，例如：
   - `feat(image-text): 支持选区样式编辑`
   - `fix(resource): 修复详情页返回上下文`
5. 如果一次改动横跨多个模块，但没有单一核心模块，可以省略 `scope`。

## 选择类型的建议

- 新增用户可见能力：`feat`
- 修 bug、修错误行为：`fix`
- 只改文案、说明、README：`docs`
- 只改发布、配置、脚本：`chore` 或 `build`
- 只改样式，不改逻辑：`style`
- 重组代码但行为不变：`refactor`

## 不推荐写法

- `update code`
- `modify something`
- `fix bug`
- 没有主语义的超长中文句子
- 混合多个不相关动作但没有主次

## 推荐输出方式

如果用户让你生成 commit message，优先直接给出 1 条推荐；必要时再补 2 到 3 条备选。若已经进入“执行提交”阶段，不要给多选，直接给最优解并执行。

例如：

- `feat(image-text): 支持选区文字样式编辑`
- `fix(resource): 保留创作者详情返回上下文`
- `docs: 更新站点为个人网站定位`

---
name: conventional-commit-guard
description: 在 Valley MAS 中编写符合 Conventional Commits 规范的提交信息。适用于需要生成、整理或检查 git commit message 的任务。
---

# Conventional Commit 护栏

当任务涉及编写或建议 `git commit message` 时，使用这个技能。

## 目标

让提交信息默认符合 Conventional Commits 习惯，而不是临时随手写一句。

## 默认格式

```text
type(scope): summary
```

如果不需要 `scope`，可以使用：

```text
type: summary
```

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

1. `summary` 用英文短句，简洁直接。
2. 总结改动结果，不要写成过程描述。
3. 优先写“做了什么”，不要写“我改了什么”。
4. 如果改动明显属于某个模块，补上 `scope`，例如：
   - `feat(image-text): support per-selection font sizing`
   - `fix(blog): allow authors to open private posts`
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
- 纯中文长句
- 混合多个不相关动作但没有主次

## 推荐输出方式

如果用户让你生成 commit message，优先直接给出 1 条推荐；必要时再补 2 到 3 条备选。

例如：

- `feat(image-text): support selection-based text styling`
- `fix(resource): preserve creator return context on detail pages`
- `docs: reposition site description as a personal website`

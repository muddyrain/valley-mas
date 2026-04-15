---
name: conventional-commit-guard
description: 在 Valley MAS 中编写符合 Conventional Commits 规范的提交信息。适用于需要生成、整理或检查 git commit message 的任务。
category: general
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

如果用户让你生成 commit message，优先直接给出 1 条推荐；必要时再补 2 到 3 条备选。

例如：

- `feat(image-text): 支持选区文字样式编辑`
- `fix(resource): 保留创作者详情返回上下文`
- `docs: 更新站点为个人网站定位`

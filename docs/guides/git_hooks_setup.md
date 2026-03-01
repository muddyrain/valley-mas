# Git Hooks 配置指南 - Lefthook

## 🎯 为什么选择 Lefthook？

### Lefthook vs Husky

| 特性 | Lefthook ⭐ | Husky |
|------|------------|-------|
| **性能** | ⚡ 极快（Go 编写，二进制执行） | ⚠️ 较慢（Node.js 脚本） |
| **配置** | ✅ 单个 `lefthook.yml` 文件 | ⚠️ 多个 shell 脚本文件 |
| **并行执行** | ✅ 原生支持多任务并行 | ❌ 需要额外工具（lint-staged） |
| **跨平台** | ✅ 完美支持 Windows/Mac/Linux | ⚠️ Windows 需要额外配置 |
| **安装** | ✅ 自动安装 git hooks | ⚠️ 需要 prepare script |
| **Monorepo** | ✅ 原生支持 | ⚠️ 需要额外配置 |
| **文件过滤** | ✅ 内置 glob 匹配 | ⚠️ 需要 lint-staged |
| **失败处理** | ✅ 灵活的失败策略 | ⚠️ 默认全部失败 |
| **配置复杂度** | ✅ 简单直观 | ⚠️ 需要多个工具配合 |

**结论：Lefthook 是现代化的最佳选择！** 🚀

---

## 📦 安装

### 1. 安装 Lefthook

```bash
# 安装到根目录
pnpm add -D -w lefthook

# 或者全局安装（可选）
# npm install -g @evilmartians/lefthook
```

### 2. 初始化

```bash
# 生成配置文件
npx lefthook install
```

---

## ⚙️ 配置文件

在项目根目录创建 `lefthook.yml`：

```yaml
# lefthook.yml - Git Hooks 配置

# 🎨 Pre-commit：提交前检查
pre-commit:
  parallel: true  # 并行执行，提速！
  
  commands:
    # 1️⃣ Lint 检查（所有子项目）
    lint:
      glob: "*.{js,ts,jsx,tsx}"
      run: pnpm turbo lint
      
    # 2️⃣ 格式化检查
    format-check:
      glob: "*.{js,ts,jsx,tsx,json,md}"
      run: pnpm turbo format -- --check
      
    # 3️⃣ 类型检查（可选，较慢）
    # type-check:
    #   glob: "*.{ts,tsx}"
    #   run: pnpm turbo check
  
  # 或者使用 staged files（只检查暂存的文件）
  # scripts:
  #   "lint-staged":
  #     runner: bash

# 📝 Commit-msg：提交信息检查
commit-msg:
  commands:
    # 检查 commit message 格式（Conventional Commits）
    commitlint:
      run: npx commitlint --edit {1}

# 🚀 Pre-push：推送前检查
pre-push:
  parallel: true
  
  commands:
    # 1️⃣ 运行测试
    test:
      run: pnpm turbo test
      
    # 2️⃣ 构建检查
    build:
      run: pnpm turbo build

# ⚙️ 全局配置
skip_output:
  - meta        # 隐藏元信息
  - success     # 隐藏成功信息（可选）

colors: true    # 彩色输出
```

---

## 🎯 推荐配置（针对你的项目）

### 方案 1：快速检查（推荐）

只检查 **staged files**（暂存的文件），速度最快：

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  
  commands:
    # Biome 检查和修复
    biome:
      glob: "*.{js,ts,jsx,tsx,json}"
      run: pnpm biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}
      stage_fixed: true  # 自动 stage 修复的文件
    
    # 格式化
    format:
      glob: "*.{js,ts,jsx,tsx,json,md}"
      run: pnpm biome format --write {staged_files}
      stage_fixed: true

commit-msg:
  commands:
    # 简单的 commit message 检查
    message-check:
      run: |
        msg=$(cat {1})
        if ! echo "$msg" | grep -qE "^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .{1,}"; then
          echo "❌ Commit message 格式错误！"
          echo "请使用: <type>(<scope>): <subject>"
          echo "示例: feat(auth): add cookie support"
          exit 1
        fi
```

### 方案 2：完整检查

检查所有项目，更严格：

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  
  commands:
    lint:
      glob: "*.{js,ts,jsx,tsx}"
      run: pnpm turbo lint --filter="[HEAD]"  # 只检查改动的包
      
    format-check:
      glob: "*.{js,ts,jsx,tsx,json,md}"
      run: pnpm turbo format -- --check
      
    type-check:
      glob: "*.{ts,tsx}"
      run: pnpm turbo check --filter="[HEAD]"

commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}

pre-push:
  parallel: false  # 串行执行，确保构建成功
  
  commands:
    build:
      run: pnpm turbo build
```

---

## 📝 配置 Commitlint（可选）

如果要严格检查 commit message：

### 1. 安装

```bash
pnpm add -D -w @commitlint/cli @commitlint/config-conventional
```

### 2. 创建配置

创建 `commitlint.config.js`：

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // Bug 修复
        'docs',     // 文档
        'style',    // 代码格式
        'refactor', // 重构
        'perf',     // 性能优化
        'test',     // 测试
        'chore',    // 构建/工具
        'revert',   // 回退
        'build',    // 构建
        'ci',       // CI/CD
      ],
    ],
    'subject-case': [0], // 不限制主题大小写
    'subject-max-length': [2, 'always', 100],
  },
};
```

---

## 🚀 使用

### 自动运行

配置好后，git hooks 会**自动运行**：

```bash
# 正常提交
git add .
git commit -m "feat: add user export"  
# ↑ 自动运行 pre-commit hooks

git push
# ↑ 自动运行 pre-push hooks
```

### 手动测试

```bash
# 测试 pre-commit hook
npx lefthook run pre-commit

# 测试 commit-msg hook
echo "feat: test message" | npx lefthook run commit-msg

# 测试 pre-push hook
npx lefthook run pre-push
```

### 跳过 Hooks（紧急情况）

```bash
# 跳过 pre-commit
git commit --no-verify -m "fix: emergency fix"

# 跳过 pre-push
git push --no-verify

# 或者设置环境变量
LEFTHOOK=0 git commit -m "skip hooks"
```

---

## 📊 性能对比

### Husky + lint-staged

```
安装时间：~5s
配置文件：3-4 个文件
pre-commit 耗时：~3-5s（串行）
学习成本：中等
```

### Lefthook

```
安装时间：~2s
配置文件：1 个文件
pre-commit 耗时：~1-2s（并行）
学习成本：低
```

---

## 🎨 最佳实践

### 1. 渐进式配置

**第一阶段**：基础检查
```yaml
pre-commit:
  commands:
    lint:
      run: pnpm turbo lint
```

**第二阶段**：添加格式化
```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      run: pnpm turbo lint
    format:
      run: pnpm turbo format
```

**第三阶段**：完整检查
```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      run: pnpm turbo lint
    format:
      run: pnpm turbo format
    type-check:
      run: pnpm turbo check
```

### 2. Monorepo 优化

只检查改动的包：

```yaml
pre-commit:
  commands:
    lint:
      run: pnpm turbo lint --filter="[HEAD]"
```

### 3. 只检查 Staged Files

最快的方案：

```yaml
pre-commit:
  commands:
    biome:
      glob: "*.{js,ts,jsx,tsx}"
      run: pnpm biome check --write {staged_files}
      stage_fixed: true
```

### 4. 错误处理

```yaml
pre-commit:
  commands:
    lint:
      run: pnpm turbo lint
      fail_text: "Lint 失败！请运行 pnpm lint 修复"
    
    format:
      run: pnpm turbo format -- --check
      fail_text: "格式化失败！请运行 pnpm format 修复"
```

---

## 🔧 故障排除

### 问题 1：Hooks 没有运行

```bash
# 重新安装 hooks
npx lefthook install

# 检查 git hooks
ls .git/hooks/

# 应该看到：
# - pre-commit
# - commit-msg
# - pre-push
```

### 问题 2：Windows 路径问题

```yaml
# 使用正斜杠
pre-commit:
  commands:
    lint:
      run: pnpm turbo lint
      # 不要用：C:\path\to\script.bat
```

### 问题 3：性能太慢

```yaml
# 方案 1：只检查改动的文件
pre-commit:
  commands:
    lint:
      glob: "*.{js,ts,jsx,tsx}"
      run: pnpm biome check {staged_files}

# 方案 2：只检查改动的包
pre-commit:
  commands:
    lint:
      run: pnpm turbo lint --filter="[HEAD]"

# 方案 3：关闭某些慢的检查
pre-commit:
  commands:
    # type-check:  # 太慢，注释掉
    #   run: pnpm turbo check
```

---

## 📚 更多资源

- [Lefthook 官方文档](https://github.com/evilmartians/lefthook)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Commitlint 文档](https://commitlint.js.org/)

---

## 🎯 总结

### 为什么选 Lefthook？

1. ⚡ **性能**：Go 编写，比 Husky 快 2-3 倍
2. ✅ **简单**：单个 YAML 文件配置
3. 🔥 **现代**：原生支持并行、Monorepo、glob 匹配
4. 🌍 **跨平台**：Windows/Mac/Linux 无缝支持
5. 📦 **零依赖**：不需要 lint-staged 等额外工具

### 快速开始

```bash
# 1. 安装
pnpm add -D -w lefthook

# 2. 初始化
npx lefthook install

# 3. 创建配置（使用推荐配置）
# 复制上面的 lefthook.yml

# 4. 测试
git add .
git commit -m "feat: test lefthook"
```

**你的项目现在有了现代化的 Git Hooks 了！** 🎉

---

**配置时间**：2026年3月1日  
**推荐方案**：Lefthook（方案 1 - 快速检查）

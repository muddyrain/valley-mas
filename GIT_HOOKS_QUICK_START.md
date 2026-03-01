# 🚀 Git Hooks 快速安装指南

## ⚡ 一键安装（推荐）

```bash
# 1. 安装 Lefthook
pnpm add -D -w lefthook

# 2. 安装 Git Hooks
pnpm prepare

# 3. 测试
pnpm hooks:test
```

完成！现在 git commit 时会自动检查代码了 ✅

---

## 📝 已配置的检查项

### Pre-commit（提交前）

✅ **Biome 检查**：自动修复代码问题  
✅ **格式化**：统一代码风格  
⚡ **只检查暂存文件**：速度超快（<2秒）

### Commit-msg（提交信息）

✅ **格式检查**：强制使用 Conventional Commits  
示例：`feat(auth): add cookie support`

### Pre-push（推送前，可选）

✅ **构建检查**：确保代码可以正常构建

---

## 🎯 使用

### 正常提交（自动检查）

```bash
git add .
git commit -m "feat: add user export"
# ↑ 自动运行检查，不通过会提示错误

git push
# ↑ 自动运行构建检查（可选）
```

### 手动测试

```bash
# 测试 pre-commit
pnpm hooks:test

# 或
npx lefthook run pre-commit
```

### 跳过检查（紧急情况）

```bash
# 跳过 pre-commit
git commit --no-verify -m "fix: emergency"

# 跳过 pre-push  
git push --no-verify
```

---

## 📋 Commit Message 格式

### 格式

```
<type>(<scope>): <subject>
```

### 允许的 type

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档
- `style`: 代码格式
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建/工具
- `ci`: CI/CD
- `build`: 构建系统
- `revert`: 回退

### 示例

✅ 正确：
```
feat(auth): add cookie support
fix(api): resolve login timeout issue
docs: update README
chore: upgrade dependencies
```

❌ 错误：
```
added new feature
fix bug
update
```

---

## 🔧 自定义配置

编辑 `lefthook.yml` 文件：

### 关闭某个检查

```yaml
pre-commit:
  commands:
    # 注释掉不需要的检查
    # format:
    #   run: pnpm format
```

### 关闭 pre-push

```yaml
# 注释掉整个 pre-push 配置
# pre-push:
#   commands:
#     build-check:
#       run: pnpm turbo build
```

### 添加新检查

```yaml
pre-commit:
  commands:
    # 添加类型检查
    type-check:
      glob: "*.{ts,tsx}"
      run: pnpm turbo check
```

---

## 📚 更多信息

详细文档：[docs/guides/git_hooks_setup.md](./guides/git_hooks_setup.md)

---

**安装时间**：< 1 分钟  
**运行速度**：< 2 秒  
**推荐指数**：⭐⭐⭐⭐⭐

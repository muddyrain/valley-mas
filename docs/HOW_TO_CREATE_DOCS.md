# 📝 快速创建文档指南

## 🚀 快速使用

### Windows PowerShell

```powershell
# 进入项目目录
cd d:\my-code\valley-mas

# 创建 Bug 修复文档
.\docs\new-doc.ps1 -Type bugfix -Description "cookie_expire"

# 创建新功能文档
.\docs\new-doc.ps1 -Type feature -Description "user_export"

# 创建面试题文档
.\docs\new-doc.ps1 -Type interview -Description "redis_cache"
```

### Git Bash / Linux / Mac

```bash
# 进入项目目录
cd /d/my-code/valley-mas

# 赋予执行权限（首次使用）
chmod +x docs/new-doc.sh

# 创建 Bug 修复文档
./docs/new-doc.sh bugfix "cookie_expire"

# 创建新功能文档
./docs/new-doc.sh feature "user_export"

# 创建面试题文档
./docs/new-doc.sh interview "redis_cache"
```

## 📋 文档类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `bugfix` | Bug 修复记录 | `2026-03-01_bugfix_cookie_expire.md` |
| `feature` | 新功能开发 | `2026-03-01_feature_user_export.md` |
| `refactor` | 代码重构 | `2026-03-01_refactor_handler_cleanup.md` |
| `migration` | 数据/架构迁移 | `2026-03-01_migration_snowflake_id.md` |
| `optimization` | 性能优化 | `2026-03-01_optimization_query_cache.md` |
| `interview` | 面试准备 | `2026-03-01_interview_auth_cookie.md` |
| `guide` | 使用指南 | `2026-03-01_guide_deployment.md` |

## 📁 文档结构

```
docs/
├── README.md                    # 📚 文档总索引
├── new-doc.ps1                  # 🔧 Windows 生成脚本
├── new-doc.sh                   # 🔧 Linux/Mac 生成脚本
├── HOW_TO_CREATE_DOCS.md        # 📖 本文件
│
├── archive/                     # 📦 归档文档（按时间）
│   ├── 2026-03-01_bugfix_xxx.md
│   └── 2026-03-01_feature_xxx.md
│
├── guides/                      # 📘 指南文档
│   ├── quick_start.md
│   └── dev_guide.md
│
├── api/                         # 📄 API 文档
│   ├── auth.md
│   └── user.md
│
└── architecture/                # 🏗️ 架构文档
    ├── system_design.md
    └── database_schema.md
```

## 📝 完整流程

### 1. 创建文档

```powershell
# PowerShell
.\docs\new-doc.ps1 -Type bugfix -Description "login_timeout"
```

### 2. 编写内容

打开生成的文档，填写内容：
- 问题描述
- 原因分析
- 解决方案
- 测试验证

### 3. 更新索引

编辑 `docs/README.md`，添加新文档链接：

```markdown
### 2026年3月1日

#### Bug 修复
- **文档**：[登录超时问题](./archive/2026-03-01_bugfix_login_timeout.md)
- **问题**：用户登录后 3 分钟就超时
- **原因**：Session 配置错误
- **标签**：`#bug` `#auth`
```

### 4. 提交代码

```bash
git add docs/
git commit -m "docs: 添加登录超时问题修复文档"
git push
```

## 🎨 文档模板

每种类型的文档都有预设模板，包含：

### Bug 修复模板
- 📅 日期
- 🐛 问题描述
- 🔍 问题原因
- ✅ 解决方案
- 🧪 测试验证
- 📊 影响范围
- 📝 总结

### 功能开发模板
- 📅 日期
- 🎯 功能描述
- 💡 需求背景
- 🏗️ 设计方案
- 💻 实现细节
- 🧪 测试
- 📝 总结

### 面试题模板
- 📅 日期
- 🎯 问题
- 📝 标准回答（开场/展开/升华）
- 🎤 常见追问
- 💡 加分项
- 📝 总结

## 💡 最佳实践

### ✅ 应该做

1. **及时记录**：完成工作后立即创建文档
2. **命名规范**：使用脚本生成，确保格式统一
3. **内容充实**：包含代码示例、测试步骤
4. **更新索引**：在 README.md 中添加链接
5. **版本控制**：提交到 Git

### ❌ 避免

1. ❌ 手动命名（容易格式不统一）
2. ❌ 延迟记录（细节容易遗忘）
3. ❌ 内容空泛（缺少实际案例）
4. ❌ 忘记索引（文档孤立）
5. ❌ 不提交 Git（丢失记录）

## 🔍 查找文档

### 按日期查找

```powershell
# PowerShell - 查看最近的文档
Get-ChildItem docs\archive\ | Sort-Object LastWriteTime -Descending | Select-Object -First 10

# Bash - 查看最近的文档
ls -lt docs/archive/ | head -10
```

### 按类型查找

```powershell
# PowerShell - 查找所有 Bug 修复文档
Get-ChildItem docs\archive\*bugfix*.md

# Bash - 查找所有 Bug 修复文档
ls docs/archive/*bugfix*.md
```

### 按关键词查找

```powershell
# PowerShell - 搜索包含 "cookie" 的文档
Get-ChildItem docs\archive\ -Recurse | Select-String "cookie"

# Bash - 搜索包含 "cookie" 的文档
grep -r "cookie" docs/archive/
```

## 📊 文档统计

```powershell
# PowerShell - 统计各类型文档数量
Get-ChildItem docs\archive\ | Group-Object {$_.Name.Split('_')[1]} | Select-Object Name, Count

# Bash - 统计各类型文档数量
ls docs/archive/ | cut -d'_' -f2 | sort | uniq -c
```

## 🎯 常见场景

### 修复了一个 Bug

```powershell
.\docs\new-doc.ps1 -Type bugfix -Description "数据库连接超时"
```

### 开发了新功能

```powershell
.\docs\new-doc.ps1 -Type feature -Description "用户导出功能"
```

### 重构了代码

```powershell
.\docs\new-doc.ps1 -Type refactor -Description "handler层重构"
```

### 准备面试题

```powershell
.\docs\new-doc.ps1 -Type interview -Description "redis缓存策略"
```

### 编写指南

```powershell
.\docs\new-doc.ps1 -Type guide -Description "docker部署指南"
```

## 🔗 相关资源

- [Markdown 语法指南](https://www.markdownguide.org/)
- [技术文档写作指南](https://developers.google.com/tech-writing)
- [项目文档总索引](./README.md)

---

**记住：好的文档是未来的自己感谢现在的你的最好方式！** 📚✨

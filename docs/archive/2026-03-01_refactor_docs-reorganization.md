# 📚 文档重组说明

> **日期**: 2026-03-01  
> **操作**: 整理根目录 Markdown 文档到 docs 目录

---

## 🎯 重组目的

根目录原有大量 Markdown 文档（11 个），导致：
- ❌ 根目录混乱，难以找到主要文档
- ❌ 文档分类不清晰
- ❌ 新手不知道从哪里开始

重组后：
- ✅ 根目录只保留 `README.md` 和 `CHANGELOG.md`
- ✅ 文档按功能分类清晰
- ✅ 提供文档索引 (`docs/INDEX.md`) 快速查找

---

## 📁 文档迁移记录

### 根目录 → docs/quick-reference/ (快速参考)

| 原文件 | 新路径 | 说明 |
|--------|--------|------|
| `BIOME_QUICK_REF.md` | `docs/quick-reference/biome.md` | Biome 命令速查 |
| `DEV_STANDARDS.md` | `docs/quick-reference/standards.md` | 开发规范速查 |
| `GIT_HOOKS_QUICK_START.md` | `docs/quick-reference/git-hooks.md` | Git Hooks 参考 |
| `REFERENCE_CARD.md` | `docs/quick-reference/project-overview.md` | 项目概览 |

### 根目录 → docs/development/ (开发指南)

| 原文件 | 新路径 | 说明 |
|--------|--------|------|
| `CHECKLIST.md` | `docs/development/checklist.md` | 提交检查清单 |
| `CLAUDE.md` | `docs/development/ai-assistant-guide.md` | AI 助手指南 |
| `DEV_GUIDE.md` | `docs/development/guide.md` | 开发指南 |

### 根目录 → docs/api/ (API 文档)

| 原文件 | 新路径 | 说明 |
|--------|--------|------|
| `SWAGGER_ACCESS.md` | `docs/api/swagger-access.md` | Swagger 访问说明 |

### 根目录 → docs/ (快速开始)

| 原文件 | 新路径 | 说明 |
|--------|--------|------|
| `GET_STARTED.md` | `docs/getting-started.md` | 快速开始指南 |

### 重复文档

| 原文件 | 新路径 | 状态 |
|--------|--------|------|
| `QUICKSTART.md` | `docs/quickstart-duplicate-1.md` | ⚠️ 待清理 |
| `QUICK_START.md` | `docs/quickstart-duplicate-2.md` | ⚠️ 待清理 |

---

## 📂 新的文档结构

```
valley-mas/
├── README.md                           # ✅ 项目主文档
├── CHANGELOG.md                        # ✅ 版本日志
└── docs/
    ├── INDEX.md                        # 📑 文档索引（新增）
    ├── README.md                       # 文档中心入口
    ├── getting-started.md              # 快速开始
    │
    ├── quick-reference/                # 快速参考
    │   ├── biome.md                   # Biome 命令
    │   ├── standards.md               # 开发规范
    │   ├── git-hooks.md               # Git Hooks
    │   └── project-overview.md        # 项目概览
    │
    ├── development/                    # 开发指南
    │   ├── guide.md                   # 开发指南
    │   ├── checklist.md               # 检查清单
    │   └── ai-assistant-guide.md      # AI 助手
    │
    ├── api/                            # API 文档
    │   └── swagger-access.md          # Swagger 访问
    │
    ├── guides/                         # 详细指南集合
    │   └── ...
    │
    └── archive/                        # 历史归档
        └── ...
```

---

## 🔧 相关配置更新

### Lefthook 配置更新

修改 `lefthook.yml`，排除 Markdown 文件的格式化检查：

```yaml
# 2️⃣ 格式化检查（排除 Markdown 文件）
format:
  glob: "*.{js,ts,jsx,tsx,json}"  # 移除了 md
  run: pnpm biome format --write {staged_files}
```

**原因**：Biome 不支持 Markdown 格式化，包含 `*.md` 会导致 Git hooks 失败。

---

## 📖 如何查找文档

### 方法 1：查看文档索引（推荐）
```bash
# 打开文档索引
code docs/INDEX.md
```

### 方法 2：使用 VS Code 搜索
```
Ctrl + P → 输入文件关键词
```

### 方法 3：查看 docs/README.md
快速导航到常用文档

---

## ✅ 重组检查清单

- [x] 移动 11 个 MD 文件到 docs 目录
- [x] 创建 `docs/INDEX.md` 文档索引
- [x] 更新 `docs/README.md` 指向索引
- [x] 修改 `lefthook.yml` 排除 MD 文件
- [x] 测试 Git commit hooks 正常工作
- [x] 提交并推送到远程仓库

---

## 📝 后续计划

1. **清理重复文档**
   - [ ] 合并 `quickstart-duplicate-1.md` 和 `quickstart-duplicate-2.md`
   - [ ] 删除冗余内容

2. **完善文档索引**
   - [ ] 添加更多分类标签
   - [ ] 添加难度标记（新手/进阶/专家）

3. **文档自动化**
   - [ ] 使用脚本检查文档链接有效性
   - [ ] 自动生成文档目录

---

**✨ 现在根目录清爽多了！查找文档更方便了！**

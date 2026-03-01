# 📚 Valley MAS 项目文档

> **文档已重新组织！** 请查看 [📑 文档索引](./INDEX.md) 获取完整文档列表。

---

## 🎯 快速导航

### 新手必读
- [**快速开始指南**](./getting-started.md) - 5 分钟搭建开发环境

### 开发规范（⭐ 重要）
- [**开发规范速查**](./quick-reference/standards.md) - Biome + API 请求规范
- [**API 请求规范**](./API_REQUEST_GUIDE.md) - 前端 API 封装标准
- [**代码质量工具**](./CODE_QUALITY_TOOLS.md) - Biome 完整指南

### 完整文档
📑 查看 [文档索引 (INDEX.md)](./INDEX.md) 获取所有文档列表

---

## 📁 文档目录结构

```
docs/
├── README.md                           # 文档索引（本文件）
├── archive/                            # 归档文档（按时间命名）
│   ├── 2026-03-01_auth_cookie_migration.md
│   ├── 2026-03-01_bugfix_cookie_expire.md
│   ├── 2026-03-01_interview_auth_cookie.md
│   └── ...
├── guides/                             # 开发指南（持续更新）
│   ├── quick_start.md
│   ├── dev_guide.md
│   └── deployment.md
├── api/                                # API 文档
│   ├── auth.md
│   ├── user.md
│   └── admin.md
└── architecture/                       # 架构文档
    ├── system_design.md
    ├── database_schema.md
    └── security.md
```

## 📝 文档命名规范

### 归档文档（archive/）- 按时间命名

格式：`YYYY-MM-DD_描述.md`

**示例：**
- ✅ `2026-03-01_auth_cookie_migration.md` - 认证方式迁移
- ✅ `2026-03-01_bugfix_cookie_expire.md` - Cookie 过期时间修复
- ✅ `2026-02-28_snowflake_id_migration.md` - Snowflake ID 迁移
- ✅ `2026-02-27_handler_refactor.md` - Handler 重构记录

**命名规则：**
- 日期格式：`YYYY-MM-DD`（年-月-日）
- 描述使用小写字母和下划线
- 描述要简洁明确（3-5个单词）

**分类前缀（可选）：**
- `bugfix_` - 问题修复
- `feature_` - 新功能
- `refactor_` - 重构
- `migration_` - 数据/架构迁移
- `optimization_` - 性能优化
- `interview_` - 面试相关
- `guide_` - 指南教程

### 指南文档（guides/）- 功能命名

格式：`功能描述.md`（小写+下划线）

**示例：**
- `quick_start.md` - 快速开始
- `dev_guide.md` - 开发指南
- `api_authentication.md` - API 认证
- `database_setup.md` - 数据库配置

### API 文档（api/）- 模块命名

格式：`模块名.md`

**示例：**
- `auth.md` - 认证相关 API
- `user.md` - 用户管理 API
- `admin.md` - 管理后台 API

## 📋 文档模板

### 归档文档模板

```markdown
# [功能/问题] 标题

## 📅 日期
YYYY年MM月DD日

## 🎯 背景/问题
简述背景或遇到的问题

## 🔍 原因分析
详细分析原因

## ✅ 解决方案
具体的解决方案和代码

## 🧪 测试验证
如何测试和验证

## 📊 影响范围
改动影响的模块和文件

## 📝 总结
关键要点总结

## 🔗 相关文档
- [相关文档链接]
```

### 指南文档模板

```markdown
# 功能指南标题

## 📖 简介
简要说明

## 🚀 快速开始
最小化示例

## 📋 详细说明
详细的使用说明

## ⚠️ 注意事项
需要注意的点

## 🔗 相关资源
相关链接
```

## 📖 现有文档索引

### 2026年3月1日

#### 🔐 认证系统改造
- **文档**：[认证方式迁移](./archive/2026-03-01_auth_cookie_migration.md)
- **内容**：从 localStorage 迁移到 HttpOnly Cookie
- **影响**：前后端认证流程
- **标签**：`#安全` `#认证` `#迁移`

#### 🐛 Bug 修复
- **文档**：[Cookie 过期时间修复](./archive/2026-03-01_bugfix_cookie_expire.md)
- **问题**：Cookie 过期时间只有 2.8 分钟
- **原因**：单位混淆（小时 vs 秒）
- **影响**：用户会话管理
- **标签**：`#bug` `#cookie`

#### 🎓 面试准备
- **文档**：[Cookie 认证面试指南](./archive/2026-03-01_interview_auth_cookie.md)
- **内容**：Cookie vs localStorage 详细面试回答
- **标签**：`#面试` `#认证` `#安全`

- **文档**：[Cookie 认证面试速记](./archive/2026-03-01_interview_cookie_quick.md)
- **内容**：面试快速复习版本
- **标签**：`#面试` `#速记`

#### 📚 历史归档文档（legacy_前缀）

以下是项目早期创建的文档，已统一归档到 `archive/` 目录：

- `2026-03-01_legacy_auth_implementation_summary.md` - 认证实现总结
- `2026-03-01_legacy_auth_system.md` - 认证系统设计
- `2026-03-01_legacy_bugfix_init.md` - 初始化问题修复
- `2026-03-01_legacy_final_summary.md` - 最终总结
- `2026-03-01_legacy_fix_401_auth.md` - 401 认证问题修复
- `2026-03-01_legacy_handler_refactor.md` - Handler 重构记录
- `2026-03-01_legacy_handler_reference.md` - Handler 参考
- `2026-03-01_legacy_optimization_complete.md` - 优化完成记录
- `2026-03-01_legacy_optimization_guide.md` - 优化指南
- `2026-03-01_legacy_snowflake_id_migration.md` - Snowflake ID 迁移
- `2026-03-01_legacy_summary.md` - 项目总结
- `2026-03-01_legacy_user_api.md` - 用户 API 文档
- `2026-03-01_legacy_user_management_done.md` - 用户管理完成

> **说明**：这些文档使用 `legacy_` 前缀标记，表示是项目早期文档，已按时间归档。

### 历史文档

## 🔄 文档维护流程

### 1. 创建新文档

```bash
# 使用今天的日期
YYYY-MM-DD_描述.md

# 示例
2026-03-01_feature_user_export.md
```

### 2. 填写内容

使用对应的模板填写内容

### 3. 更新索引

在本 README.md 中添加文档索引

### 4. 归档旧文档

将完成的文档移动到 `archive/` 目录

## 📊 文档统计

| 类型 | 数量 | 说明 |
|------|------|------|
| 归档文档 | 17 | 按时间命名的历史记录（含 legacy 文档） |
| 指南文档 | 3 | 文档管理指南 |
| API 文档 | 0 | 待补充 |
| 架构文档 | 0 | 待补充 |

**归档文档分类：**
- 当前活跃文档：4 篇（认证迁移、Bug 修复、面试准备）
- 历史遗留文档：13 篇（legacy_ 前缀）

## 🎯 待完成文档

- [ ] API 完整文档
- [ ] 数据库 Schema 文档
- [ ] 部署指南
- [ ] 测试指南
- [ ] 性能优化记录

## 💡 文档编写建议

### ✅ 应该做

1. **及时记录**：完成功能/修复 Bug 后立即记录
2. **详细具体**：包含代码示例、测试方法
3. **结构清晰**：使用标题、列表、代码块
4. **时间命名**：归档文档使用 `YYYY-MM-DD` 前缀
5. **更新索引**：在本文件中添加链接

### ❌ 避免

1. ❌ 模糊描述：如"修改了一些东西"
2. ❌ 缺少日期：无法追溯时间线
3. ❌ 没有示例：光说不练
4. ❌ 孤立文档：不在索引中
5. ❌ 重复命名：造成混淆

## 🔧 快速命令

### 创建新文档

```bash
# 在项目根目录
cd docs/archive

# 创建今天的文档
echo "# 标题" > $(date +%Y-%m-%d)_描述.md

# Windows PowerShell
$date = Get-Date -Format "yyyy-MM-dd"
New-Item "$date`_description.md"
```

### 查看最近文档

```bash
# Linux/Mac
ls -lt docs/archive/ | head -10

# Windows PowerShell
Get-ChildItem docs\archive\ | Sort-Object LastWriteTime -Descending | Select-Object -First 10
```

## 🔗 相关资源

- [Markdown 语法](https://www.markdownguide.org/)
- [技术文档写作指南](https://developers.google.com/tech-writing)
- [README 最佳实践](https://github.com/matiassingers/awesome-readme)

---

**最后更新**：2026年3月1日  
**维护者**：Valley 开发团队  
**版本**：v1.0.0

---

## 📌 快速导航

- [开发指南](../GET_STARTED.md)
- [API 参考](../README.md#api)
- [部署文档](../README.md#deployment)
- [贡献指南](../README.md#contributing)

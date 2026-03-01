# Valley MAS 文档索引

> 📚 项目文档中心 - 快速找到你需要的文档

---

## 🚀 快速开始

- [**快速开始指南**](./getting-started.md) - 新手必读，快速搭建开发环境

---

## 📖 开发指南

### 核心开发文档
- [开发指南](./development/guide.md) - 完整的开发流程和最佳实践
- [开发检查清单](./development/checklist.md) - 提交代码前的质量检查
- [AI 助手使用指南](./development/ai-assistant-guide.md) - 如何高效使用 AI 辅助开发

---

## ⚡ 快速参考

### 常用命令速查
- [**开发规范速查**](./quick-reference/standards.md) - Biome + API 请求规范（⭐ 推荐）
- [Biome 命令速查](./quick-reference/biome.md) - 代码格式化和 Lint 命令
- [Git Hooks 参考](./quick-reference/git-hooks.md) - Git 提交钩子配置
- [项目概览](./quick-reference/project-overview.md) - 项目结构和技术栈速览

---

## 🔧 技术文档

### 代码质量
- [**代码质量工具指南**](./CODE_QUALITY_TOOLS.md) - Biome 完整使用指南（⭐ 推荐）

### API 规范
- [**API 请求规范**](./API_REQUEST_GUIDE.md) - 前端 API 封装标准（⭐ 必读）
- [API 文档](./API_DOCUMENTATION.md) - 接口说明
- [Swagger 快速开始](./SWAGGER_QUICK_START.md) - API 在线文档
- [Swagger 访问说明](./api/swagger-access.md) - 如何访问 API 文档

### 存储集成
- [火山引擎 TOS 集成](./TOS_INTEGRATION.md) - 对象存储完整配置
- [TOS Bucket 配置](./TOS_BUCKET_SETUP.md) - Bucket 权限设置

---

## 📦 数据库与依赖

- [Go 依赖说明](./GO_MOD_EXPLAINED.md) - Go modules 详解
- [依赖清理指南](./DEPENDENCY_CLEANUP.md) - 如何清理无用依赖

---

## 📝 开发指南集合

详见 [guides](./guides/) 目录：

### 功能开发
- [后端开发计划](./guides/2026-03-01_roadmap_backend-development-plan.md)
- [优先开发功能](./guides/2026-03-01_quickstart_what-to-build-first.md)
- [口令系统设计](./guides/2026-03-01_design_code-system-design.md)
- [口令系统简化决策](./guides/2026-03-01_decision_code-system-simplification.md)

### 技术实践
- [Snowflake ID 完整指南](./guides/2026-03-01_standard_snowflake-id-complete-guide.md) ⭐
- [Snowflake ID 详解](./guides/2026-03-01_explanation_snowflake-id-explained.md)
- [ID 生成性能对比](./guides/2026-03-01_benchmark_snowflake-id-comparison.md)
- [数据库迁移实践](./guides/2026-03-01_migration_database-migration-practice.md)

### Bug 修复记录
- [JavaScript 精度丢失修复](./guides/2026-03-01_bugfix_javascript-number-precision-loss.md)
- [用户 ID 唯一性分析](./guides/2026-03-01_analysis_user-id-uniqueness.md)

### 特性说明
- [管理后台自动 Token 验证](./guides/2026-03-01_feature_admin-auto-token-validation.md)
- [口令长度更新为 5 位](./guides/2026-03-01_update_code-5-chars.md)

---

## 🗄️ 归档文档

历史版本文档见 [archive](./archive/) 目录：

- [认证系统实现总结（历史版本）](./archive/2026-03-01_legacy_auth_implementation_summary.md)
- [用户管理完成记录（历史版本）](./archive/2026-03-01_legacy_user_management_done.md)
- [Snowflake ID 迁移记录（历史版本）](./archive/2026-03-01_legacy_snowflake_id_migration.md)
- 更多归档文档...

---

## 🔄 重复文档清理

以下文档为重复内容，等待清理：
- [quickstart-duplicate-1.md](./quickstart-duplicate-1.md)
- [quickstart-duplicate-2.md](./quickstart-duplicate-2.md)

---

## 📌 文档维护规范

### 文档分类规则

1. **根目录保留**：
   - `README.md` - 项目主文档
   - `CHANGELOG.md` - 版本更新日志

2. **快速开始** (`getting-started.md`)：
   - 新手入门指南
   - 环境搭建步骤

3. **开发指南** (`development/`)：
   - 开发流程文档
   - 团队协作规范

4. **快速参考** (`quick-reference/`)：
   - 命令速查表
   - 规范速查卡

5. **技术文档** (docs 根目录)：
   - API 规范
   - 技术集成文档
   - 架构设计文档

6. **开发指南集合** (`guides/`)：
   - 功能开发指南
   - 技术实践文档
   - Bug 修复记录
   - 以日期开头命名：`YYYY-MM-DD_type_title.md`

7. **归档文档** (`archive/`)：
   - 历史版本文档
   - 已废弃的实现方案

### 文档命名规范

- **快速参考**：简短名称，如 `biome.md`, `git-hooks.md`
- **指南文档**：`YYYY-MM-DD_type_title.md`
  - `type`: `feature`, `bugfix`, `guide`, `standard`, `design` 等
  - `title`: 短横线分隔的英文描述

### 文档更新流程

1. 创建新文档时，添加到对应目录
2. 更新文档后，同步更新 `INDEX.md`
3. 废弃文档移至 `archive/` 并添加废弃标记
4. 定期清理重复和过时文档

---

**💡 提示**：推荐新手从 ⭐ 标记的文档开始阅读！

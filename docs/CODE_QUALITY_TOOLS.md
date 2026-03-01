# 代码质量工具说明

## 🎯 本项目使用 Biome

本项目使用 **Biome** 作为代码格式化和 Lint 工具，**不使用 ESLint 和 Prettier**。

### 为什么选择 Biome？

- ✅ **统一工具**：一个工具同时处理格式化和 Lint，无需配置多个工具
- ⚡ **超快速度**：使用 Rust 编写，比 ESLint + Prettier 快 10-100 倍
- 🔧 **简单配置**：单一配置文件 `biome.json`
- 🚀 **现代化**：原生支持 TypeScript、JSX、JSON 等
- 💪 **自动修复**：大部分问题可以自动修复

---

## 📁 配置文件位置

项目根目录：`d:\my-code\valley-mas\biome.json`

---

## 🚀 常用命令

### 检查代码
```bash
# 检查所有文件
pnpm biome check

# 检查特定文件
pnpm biome check apps/admin/src/**/*.tsx

# 自动修复问题
pnpm biome check --write

# 只检查格式
pnpm biome format

# 只检查 Lint
pnpm biome lint
```

### Git Hooks (Lefthook)

项目已配置 Git Hooks，在 `commit` 前自动运行 Biome 检查：

```yaml
# lefthook.yml
pre-commit:
  commands:
    biome-check:
      run: pnpm biome check --write {staged_files}
      stage_fixed: true
```

**效果**：
- 每次 `git commit` 前自动格式化暂存的文件
- 自动修复 Lint 问题
- 修复后自动 stage

---

## ⚙️ VS Code 集成

### 安装 Biome 扩展

1. 打开 VS Code
2. 搜索并安装：**Biome** (biomejs.biome)
3. 重启 VS Code

### 配置默认格式化工具

在 `.vscode/settings.json` 中：

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

---

## ❌ 不要使用 ESLint

如果你在代码中看到以下注释，**请删除**：

```tsx
// ❌ 错误 - 不要使用 ESLint 注释
// eslint-disable-next-line
// eslint-disable

// ✅ 正确 - 使用 Biome 注释（如果必要）
// biome-ignore lint/suspicious/noExplicitAny: 临时忽略
```

---

## 🔍 Biome 规则

### 自动修复的规则

大部分格式和简单的 Lint 问题都能自动修复：

- 缩进、空格、分号
- 导入排序
- 未使用的变量
- 类型断言优化
- 等等...

### 需要手动修复的规则

某些安全或逻辑相关的问题需要手动修复：

- 空指针检查
- 类型错误
- 逻辑错误
- 等等...

---

## 📝 忽略规则

### 忽略特定规则

```tsx
// 忽略单行
// biome-ignore lint/suspicious/noExplicitAny: 临时使用 any
const data: any = fetchData()

// 忽略整个文件
// biome-ignore-file
```

### 配置文件中忽略

在 `biome.json` 中：

```json
{
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "off"
      }
    }
  }
}
```

---

## 🎨 格式化规则

项目使用的格式化规则（`biome.json`）：

- **缩进**：2 空格（Tab）
- **引号**：双引号
- **分号**：必须
- **行宽**：100 字符
- **尾随逗号**：ES5 风格

---

## 🛠️ CI/CD 集成

### GitHub Actions 示例

```yaml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm biome check
```

---

## 📚 更多资源

- **Biome 官网**：https://biomejs.dev
- **文档**：https://biomejs.dev/zh-cn/
- **规则列表**：https://biomejs.dev/linter/rules/
- **VS Code 扩展**：https://marketplace.visualstudio.com/items?itemName=biomejs.biome

---

## 🚨 迁移说明

如果你之前使用过 ESLint/Prettier：

### 移除旧工具

```bash
# 删除依赖
pnpm remove eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-config-prettier eslint-plugin-react

# 删除配置文件
rm .eslintrc.json .eslintrc.js .prettierrc .prettierignore
```

### 安装 Biome

```bash
pnpm add -D --save-exact @biomejs/biome
```

### 初始化配置

```bash
pnpm biome init
```

---

## ✅ 检查清单

在开发时：

- [ ] 已安装 Biome VS Code 扩展
- [ ] 已配置保存时自动格式化
- [ ] 代码中没有 ESLint 注释
- [ ] commit 前自动运行 Biome 检查
- [ ] CI 中包含 Biome 检查

---

**更新时间**：2026-03-01  
**工具版本**：Biome v1.9.4  
**项目状态**：✅ 已完全移除 ESLint/Prettier

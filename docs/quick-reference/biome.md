# Biome 快速参考卡片

> **本项目使用 Biome，不使用 ESLint/Prettier**

---

## 🚀 快速命令

| 命令 | 说明 |
|------|------|
| `pnpm biome check` | 检查所有文件 |
| `pnpm biome check --write` | 检查并自动修复 |
| `pnpm biome format` | 只格式化 |
| `pnpm biome lint` | 只 Lint |
| `pnpm biome check {file}` | 检查特定文件 |

---

## 📝 注释语法

### ❌ 不要使用（ESLint）
```tsx
// eslint-disable-next-line
// eslint-disable
/* eslint-disable */
```

### ✅ 使用（Biome）
```tsx
// biome-ignore lint/suspicious/noExplicitAny: 临时使用
const data: any = {}

// biome-ignore lint/correctness/useExhaustiveDependencies: deps 稳定
useEffect(() => {}, [])

// 忽略整个文件
// biome-ignore-file
```

---

## 🔧 VS Code 设置

**`.vscode/settings.json`**:
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

## 🎯 格式化规则

- **缩进**: 2 空格
- **引号**: 双引号 `"`
- **分号**: 必须 `;`
- **行宽**: 100 字符
- **尾随逗号**: ES5

---

## 📦 配置文件

**`biome.json`** (项目根目录)

忽略规则示例：
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

## 🔍 常见问题

### Q: 为什么不用 ESLint？
A: Biome 更快（10-100倍）、配置更简单、功能更强大。

### Q: Biome 支持所有 ESLint 规则吗？
A: 支持大部分常用规则，且在持续增加。

### Q: 如何禁用某个规则？
A: 使用 `biome-ignore` 注释或在 `biome.json` 中配置。

---

## 📚 更多资源

- 官网：https://biomejs.dev
- 文档：https://biomejs.dev/zh-cn/
- 规则：https://biomejs.dev/linter/rules/
- VS Code: [Biome 扩展](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)

---

**✨ 记住：本项目只使用 Biome！**

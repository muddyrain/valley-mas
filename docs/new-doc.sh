#!/bin/bash
# Valley 文档生成脚本
# 使用方法: ./docs/new-doc.sh bugfix "cookie_expire"

TYPE=$1
DESCRIPTION=$2
DEST_DIR="archive"

# 检查参数
if [ -z "$TYPE" ] || [ -z "$DESCRIPTION" ]; then
    echo "❌ 用法: $0 <类型> <描述>"
    echo ""
    echo "类型选项："
    echo "  bugfix       - Bug 修复"
    echo "  feature      - 新功能"
    echo "  refactor     - 重构"
    echo "  migration    - 迁移"
    echo "  optimization - 优化"
    echo "  interview    - 面试"
    echo "  guide        - 指南"
    echo ""
    echo "示例："
    echo "  $0 bugfix \"cookie_expire\""
    echo "  $0 feature \"user_export\""
    exit 1
fi

# 获取当前日期
DATE=$(date +%Y-%m-%d)
FULL_DATE=$(date +%Y年%m月%d日)

# 生成文件名
FILENAME="${DATE}_${TYPE}_${DESCRIPTION}.md"
FILEPATH="$(dirname $0)/${DEST_DIR}/${FILENAME}"

# 创建目录（如果不存在）
mkdir -p "$(dirname $0)/${DEST_DIR}"

# 根据类型生成模板
case $TYPE in
    bugfix)
        cat > "$FILEPATH" <<EOF
# Bug 修复：${DESCRIPTION}

## 📅 日期
${FULL_DATE}

## 🐛 问题描述

简要描述遇到的问题

## 🔍 问题原因

详细分析问题产生的原因

### 错误代码

\`\`\`go
// 错误的代码示例
\`\`\`

### 原因分析

1. 原因1
2. 原因2

## ✅ 解决方案

### 修复代码

\`\`\`go
// 修复后的代码
\`\`\`

### 修复说明

说明修复的方法和思路

## 🧪 测试验证

### 测试步骤

1. 步骤1
2. 步骤2

### 预期结果

- ✅ 结果1
- ✅ 结果2

## 📊 影响范围

| 模块 | 文件 | 改动 |
|------|------|------|
| 模块1 | file.go | 说明 |

## 📝 总结

- ✅ 问题：...
- ✅ 修复：...
- ✅ 验证：...

## 🔗 相关文档

- [相关文档]()

---

修复完成时间：${FULL_DATE}
EOF
        ;;
    feature)
        cat > "$FILEPATH" <<EOF
# 新功能：${DESCRIPTION}

## 📅 日期
${FULL_DATE}

## 🎯 功能描述

简要描述新功能

## 💡 需求背景

为什么需要这个功能

## 🏗️ 设计方案

### 架构设计

### 数据模型

### API 设计

## 💻 实现细节

### 后端实现

\`\`\`go
// 代码示例
\`\`\`

### 前端实现

\`\`\`typescript
// 代码示例
\`\`\`

## 🧪 测试

### 功能测试

### 性能测试

## 📊 影响范围

## 📝 总结

---

完成时间：${FULL_DATE}
EOF
        ;;
    *)
        cat > "$FILEPATH" <<EOF
# ${TYPE^}: ${DESCRIPTION}

## 📅 日期
${FULL_DATE}

## 内容

在此编写内容...

---

完成时间：${FULL_DATE}
EOF
        ;;
esac

echo "✅ 文档创建成功！"
echo "📄 文件路径：$FILEPATH"
echo ""
echo "💡 下一步："
echo "   1. 编辑文档：code $FILEPATH"
echo "   2. 更新索引：编辑 docs/README.md"

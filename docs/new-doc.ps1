# Valley 文档生成脚本
# 使用方法: .\docs\new-doc.ps1 -Type bugfix -Description "cookie_expire"

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('bugfix', 'feature', 'refactor', 'migration', 'optimization', 'interview', 'guide')]
    [string]$Type,
    
    [Parameter(Mandatory=$true)]
    [string]$Description,
    
    [string]$DestDir = "archive"
)

# 获取当前日期
$date = Get-Date -Format "yyyy-MM-dd"

# 生成文件名
$filename = "${date}_${Type}_${Description}.md"
$filepath = Join-Path $PSScriptRoot $DestDir $filename

# 根据类型选择模板
$template = switch ($Type) {
    'bugfix' {
@"
# Bug 修复：$Description

## 📅 日期
$(Get-Date -Format "yyyy年MM月dd日")

## 🐛 问题描述

简要描述遇到的问题

## 🔍 问题原因

详细分析问题产生的原因

### 错误代码

``````go
// 错误的代码示例
``````

### 原因分析

1. 原因1
2. 原因2

## ✅ 解决方案

### 修复代码

``````go
// 修复后的代码
``````

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

修复完成时间：$(Get-Date -Format "yyyy年MM月dd日")
"@
    }
    'feature' {
@"
# 新功能：$Description

## 📅 日期
$(Get-Date -Format "yyyy年MM月dd日")

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

``````go
// 代码示例
``````

### 前端实现

``````typescript
// 代码示例
``````

## 🧪 测试

### 功能测试

### 性能测试

## 📊 影响范围

## 📝 总结

---

完成时间：$(Get-Date -Format "yyyy年MM月dd日")
"@
    }
    'refactor' {
@"
# 重构：$Description

## 📅 日期
$(Get-Date -Format "yyyy年MM月dd日")

## 🎯 重构目标

## 🔍 重构原因

### 现状问题

### 优化方向

## ✅ 重构方案

### 重构前

### 重构后

## 📊 对比

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
|      |        |        |

## 🧪 验证

## 📝 总结

---

完成时间：$(Get-Date -Format "yyyy年MM月dd日")
"@
    }
    'migration' {
@"
# 迁移：$Description

## 📅 日期
$(Get-Date -Format "yyyy年MM月dd日")

## 🎯 迁移目标

## 🔍 迁移原因

## ✅ 迁移方案

### 迁移前

### 迁移后

### 迁移步骤

1. 步骤1
2. 步骤2

## ⚠️ 风险评估

## 🔄 回滚方案

## 🧪 验证

## 📝 总结

---

完成时间：$(Get-Date -Format "yyyy年MM月dd日")
"@
    }
    'optimization' {
@"
# 优化：$Description

## 📅 日期
$(Get-Date -Format "yyyy年MM月dd日")

## 🎯 优化目标

## 📊 优化前性能

## ✅ 优化方案

## 📈 优化后性能

## 📝 总结

---

完成时间：$(Get-Date -Format "yyyy年MM月dd日")
"@
    }
    'interview' {
@"
# 面试题：$Description

## 📅 日期
$(Get-Date -Format "yyyy年MM月dd日")

## 🎯 问题

## 📝 标准回答

### 开场（10秒）

### 展开（30秒）

### 升华（20秒）

## 🎤 常见追问

### Q1: 问题1

**A:** 回答

## 💡 加分项

## 📝 总结

---

整理时间：$(Get-Date -Format "yyyy年MM月dd日")
"@
    }
    'guide' {
@"
# 指南：$Description

## 📖 简介

## 🚀 快速开始

## 📋 详细说明

## ⚠️ 注意事项

## 🔗 相关资源

---

编写时间：$(Get-Date -Format "yyyy年MM月dd日")
"@
    }
}

# 创建文件
$template | Out-File -FilePath $filepath -Encoding UTF8

Write-Host "✅ 文档创建成功！" -ForegroundColor Green
Write-Host "📄 文件路径：$filepath" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 下一步：" -ForegroundColor Yellow
Write-Host "   1. 编辑文档：code $filepath"
Write-Host "   2. 更新索引：编辑 docs\README.md"
Write-Host ""

# 自动打开文件（可选）
$openFile = Read-Host "是否打开文件？(Y/N)"
if ($openFile -eq 'Y' -or $openFile -eq 'y') {
    code $filepath
}

# 真实资源记录

> **重要提示**：这些资源已上传到火山引擎 TOS 对象存储，务必保持引用关系！

## 真实资源 ID 列表

### 当前生产资源

| 资源 ID | 类型 | 说明 | 状态 |
|---------|------|------|------|
| `2028474462759817216` | 真实资源 | 已上传到火山引擎 TOS | ✅ 活跃 |
| `2028475826344824832` | 真实资源 | 已上传到火山引擎 TOS | ✅ 活跃 |

## ⚠️ 注意事项

1. **禁止删除这些 ID 对应的数据库记录**
   - 删除会导致 TOS 对象存储中的文件变成孤岛数据
   - 造成存储费用浪费且数据无法追踪

2. **初始化数据时的处理**
   - `init.go` 中使用 `?force=true` 时会**自动保留**这些真实资源
   - 只清理测试假数据（URL 包含 `placeholder` 的资源）
   - 初始化后会自动关联真实资源到测试创作者（code: y2722）

3. **资源清理原则**
   - 清理资源前，先删除 TOS 中的对象
   - 使用 `DeleteResource` API 会自动清理 TOS 文件
   - 假数据（placeholder）可以安全删除

## 🔧 技术实现

### 备份与恢复机制（新版）

在强制初始化时，`init.go` 会**自动备份和恢复**所有真实资源：

**步骤 1: 备份真实资源**
```go
// 🔄 备份真实资源（非 placeholder 的资源）
var realResources []model.Resource
database.DB.Where("url NOT LIKE ?", "%placeholder%").Find(&realResources)
```

**步骤 2: 清空所有数据**
```go
// 清空所有表（包括资源表）
tx.Unscoped().Where("1 = 1").Delete(&model.Resource{})
```

**步骤 3: 重建测试数据**
```go
// 创建新的用户、创作者等测试数据
```

**步骤 4: 恢复真实资源**
```go
// 🔄 恢复备份的真实资源并关联到新创建的测试创作者
for i := range backupResources {
    backupResources[i].CreatorID = creator.ID
}
database.DB.Create(&backupResources)
```

### 优势

✅ **零数据丢失** - 所有火山引擎 TOS 资源都会被恢复  
✅ **自动识别** - 通过 URL 特征自动区分真实资源和假数据  
✅ **保持引用** - 资源 ID 和 URL 完全保持不变  
✅ **避免孤岛** - TOS 对象存储中的文件始终有数据库记录引用

## 📋 操作指南

### 初始化数据（安全模式）

```bash
# 清理所有数据，自动备份并恢复真实资源
curl http://localhost:8080/init-data?force=true
```

**执行流程**：
1. 🔄 自动检测并备份所有真实资源（URL 不包含 `placeholder`）
2. 🗑️ 清除所有用户、创作者、资源、记录等数据
3. ✅ 重新创建测试用户和创作者
4. 🔄 恢复备份的真实资源，并关联到新创建的测试创作者
5. 📊 生成模拟的下载记录和访问日志（用于图表展示）

**返回信息示例**：
```json
{
  "code": 0,
  "message": "初始化成功",
  "data": {
    "createdUsers": 5,
    "createdCreators": 1,
    "restoredResources": 2,      // 恢复的真实资源数量
    "createdResources": 2,        // 总资源数量
    "createdDownloads": 63,
    "createdAccessLogs": 42,
    "clearedUsers": 5
  }
}
```

### 添加新的真实资源

1. 通过 Admin 后台上传资源
2. 记录新的资源 ID
3. 更新本文档和 `init.go` 中的 `realResourceIDs` 数组

## 更新日志

- **2026-03-02 21:00**: 初始记录，添加 2 个真实资源 ID
- **2026-03-02 22:00**: 修改 init.go，实现假数据清理和真实资源保护机制
- **2026-03-02 22:30**: **重大升级** - 实现自动备份与恢复机制，彻底解决数据孤岛问题
  - 强制初始化时自动备份所有真实资源（通过 URL 特征识别）
  - 清空数据库后自动恢复备份的真实资源
  - 保持资源 ID 和 URL 完全不变
  - 自动关联到新创建的测试创作者
  - 无需手动维护资源 ID 列表

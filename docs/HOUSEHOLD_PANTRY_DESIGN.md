# 家庭空间与家庭库存设计

## 背景

当前 Life Trace 的家庭库存仅支持“用户管理自己的库存”。

- 库存条目依赖 `user_id`
- 列表查询和写入都按当前登录用户隔离
- 无法表达“一个家庭由多个成员共同管理同一份库存”

为了支持“创建家庭、邀请成员、共享库存、成员退出、家庭解散”等能力，需要先把“家庭”抽象成 `server` 内的通用域模型，而不是做成 `life_trace_` 专属能力。

## 设计目标

1. 家庭能力属于 `server` 的通用能力，可被多个业务模块复用。
2. 每个用户永远拥有一个不可解散的“个人空间”。
3. 用户可以额外创建或加入“共享家庭空间”。
4. 库存归属于空间 `household`，不直接归属于某个用户。
5. 加入家庭不会覆盖或吞掉用户原有个人库存。
6. 家庭解散后，家庭库存不自动归并到某个成员名下。

## 核心概念

### Household

统一的“空间”抽象，包含两种类型：

- `personal`：个人空间，系统自动创建，不可解散
- `shared`：共享家庭空间，用户主动创建，可邀请成员加入

### Household Member

表示用户和家庭的成员关系。

- 一个用户对某个家庭有一条成员关系
- 角色包括 `owner / admin / member`
- 状态包括 `active / left / removed`

### Pantry Item

库存条目应当归属于 `household`。

- 业务归属：`household_id`
- 操作归属：`created_by / updated_by`

## 业务规则

### 个人空间

1. 每个用户始终拥有一个 `personal household`
2. 个人空间不可解散
3. 原有个人库存继续留在个人空间
4. 用户加入共享家庭后，个人空间仍然存在

### 共享家庭

1. 用户可以创建共享家庭
2. `owner` 可以邀请成员
3. 成员可以主动退出家庭
4. `owner` 可以转移家庭拥有者
5. `owner` 可以解散共享家庭

### 库存归属

1. 库存永远属于 `household`
2. 库存不直接属于某个 user
3. 用户加入家庭时，不自动迁移个人库存
4. 后续可新增“移动到家庭库存 / 复制到家庭库存”能力

### 家庭解散

1. 只允许解散 `shared household`
2. `personal household` 永远不能解散
3. 解散后家庭状态改为 `dissolved`
4. 该家庭下库存保留在原 `household_id` 上，进入只读归档态
5. V1 不自动把家庭库存归并到某位成员的个人空间

### 成员退出

1. 普通成员可以直接退出
2. `owner` 如果要退出且仍有其他成员，需先转移 owner
3. 如果 `owner` 是最后一个成员，应先走“解散家庭”流程

## 数据模型

### households

- `id`
- `name`
- `kind`：`personal | shared`
- `owner_user_id`
- `status`：`active | dissolved`
- `created_at`
- `updated_at`
- `deleted_at`
- `dissolved_at`

约束建议：

- `personal` 空间对 `owner_user_id` 唯一
- `kind + status` 需要索引

### household_members

- `id`
- `household_id`
- `user_id`
- `role`：`owner | admin | member`
- `status`：`active | left | removed`
- `joined_at`
- `left_at`
- `created_at`
- `updated_at`
- `deleted_at`

约束建议：

- `household_id + user_id + status` 唯一约束
- `household_id`、`user_id` 建索引

### household_invites

- `id`
- `household_id`
- `inviter_user_id`
- `invite_code`
- `status`：`pending | accepted | expired | revoked`
- `expires_at`
- `accepted_by_user_id`
- `accepted_at`
- `created_at`
- `updated_at`
- `deleted_at`

约束建议：

- `invite_code` 唯一
- `household_id`、`status` 建索引

### life_trace_pantry_items（改造）

新增字段：

- `household_id`
- `created_by`
- `updated_by`

保留现有 `user_id` 作为迁移期兼容字段，但后续库存归属判断应逐步切换到 `household_id`。

## API 设计方向

### 通用 Household API

- `POST /api/v1/households`
- `GET /api/v1/households`
- `GET /api/v1/households/:id`
- `GET /api/v1/households/:id/members`
- `POST /api/v1/households/:id/invites`
- `POST /api/v1/households/join`
- `POST /api/v1/households/:id/leave`
- `POST /api/v1/households/:id/transfer-owner`
- `POST /api/v1/households/:id/dissolve`

### Pantry API 方向

推荐逐步改为：

- `GET /api/v1/households/:householdId/pantry`
- `POST /api/v1/households/:householdId/pantry`
- `PATCH /api/v1/households/:householdId/pantry/:id`
- `PATCH /api/v1/households/:householdId/pantry/:id/status`
- `DELETE /api/v1/households/:householdId/pantry/:id`

所有接口都需要校验当前用户是否为该家庭的 active member。

## 前端交互方向

### Pantry 页面

页面顶部新增空间切换器：

- 我的库存
- 家庭库存 · 家庭名称

用户切换的是当前查看的 `household`，而不是切换用户身份。

### Profile 页面

新增“我的家庭”管理区域：

- 当前空间列表
- 创建家庭
- 邀请成员
- 成员列表
- 退出家庭
- 转移 owner
- 解散家庭

## 迁移方案

### 第一阶段

1. 新增通用 household 数据表
2. 给 pantry 表加 `household_id / created_by / updated_by`
3. 代码层引入通用 household model
4. 暂不切换 Pantry 读写逻辑

### 第二阶段

1. 为每个用户创建 personal household
2. 回填现有 pantry 数据到 personal household
3. Pantry 接口逐步改用 `household_id`

### 第三阶段

1. 增加 household API
2. 增加邀请/加入/退出/解散流程
3. 前端增加空间切换和家庭管理界面

## 当前开发状态

本次先落地：

1. 设计文档
2. 通用 household model
3. 数据库迁移骨架
4. pantry 表新增 household 归属字段

以下内容仍未开始：

1. personal household 自动回填
2. household API
3. Pantry 按 household 查询和权限校验
4. 前端空间切换

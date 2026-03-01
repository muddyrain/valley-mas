# 用户管理 API 文档

## 概述

本系统支持多平台用户管理，包括微信小程序和抖音小程序。用户数据结构已扩展以支持各平台的特有字段。

## 数据库结构

### User 表字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | uint | 主键 |
| nickname | string | 用户昵称 |
| avatar | string | 用户头像 |
| platform | string | 平台标识 (wechat/douyin/mini_app) |
| openid | string | 通用平台唯一标识 |
| unionid | string | 通用开放平台唯一标识 |
| **抖音字段** | | |
| douyin_openid | string | 抖音用户唯一标识 |
| douyin_unionid | string | 抖音开放平台唯一标识 |
| douyin_avatar | string | 抖音头像 |
| douyin_nickname | string | 抖音昵称 |
| douyin_gender | int | 抖音性别 (0-未知/1-男/2-女) |
| douyin_city | string | 抖音用户城市 |
| douyin_province | string | 抖音用户省份 |
| douyin_country | string | 抖音用户国家 |
| **微信字段** | | |
| wechat_openid | string | 微信用户唯一标识 |
| wechat_unionid | string | 微信开放平台唯一标识 |
| **其他字段** | | |
| role | string | 用户角色 (user/admin/creator) |
| is_active | bool | 账户状态 |
| phone | string | 手机号（可选） |
| email | string | 邮箱（可选） |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

## API 接口

### 1. 获取用户列表

**接口：** `GET /api/v1/admin/users`

**参数：**
```typescript
{
  page?: number;        // 页码，默认 1
  pageSize?: number;    // 每页数量，默认 20
  keyword?: string;     // 关键词搜索（昵称、OpenID）
  platform?: string;    // 平台筛选 (wechat/douyin)
  role?: string;        // 角色筛选 (user/admin/creator)
}
```

**响应：**
```typescript
{
  code: 0,
  message: "success",
  data: {
    list: User[],
    total: number
  }
}
```

### 2. 创建用户

**接口：** `POST /api/v1/admin/users`

**参数：**
```typescript
{
  nickname: string;
  avatar?: string;
  platform: string;
  openid: string;
  unionid?: string;
  role?: string;
  // 根据 platform 提供对应的平台字段
  douyinOpenid?: string;
  wechatOpenid?: string;
  // ...其他字段
}
```

### 3. 更新用户

**接口：** `PUT /api/v1/admin/users/:id`

**参数：** 同创建用户

### 4. 删除用户

**接口：** `DELETE /api/v1/admin/users/:id`

### 5. 更新用户状态

**接口：** `PUT /api/v1/admin/users/:id/status`

**参数：**
```typescript
{
  isActive: boolean
}
```

## 抖音小程序对接指南

### 1. 抖音开放平台配置

1. 登录 [抖音开放平台](https://open.douyin.com/)
2. 创建小程序应用
3. 获取 `AppID` 和 `AppSecret`
4. 配置服务器域名

### 2. 用户登录流程

```javascript
// 小程序端
// 1. 调用登录接口获取 code
tt.login({
  success(res) {
    const code = res.code;
    // 2. 将 code 发送给后端
    tt.request({
      url: 'https://your-api.com/api/v1/auth/douyin/login',
      method: 'POST',
      data: { code },
      success(res) {
        const { token, userInfo } = res.data;
        // 保存 token 和用户信息
      }
    });
  }
});
```

### 3. 后端处理流程

```go
// 1. 使用 code 换取 openid 和 session_key
func DouyinLogin(c *gin.Context) {
    code := c.PostForm("code")
    
    // 调用抖音 API
    url := fmt.Sprintf("https://developer.toutiao.com/api/apps/v2/jscode2session?appid=%s&secret=%s&code=%s", 
        DOUYIN_APPID, DOUYIN_SECRET, code)
    
    resp, _ := http.Get(url)
    // 解析响应获取 openid, session_key, unionid
    
    // 2. 查询或创建用户
    var user model.User
    result := database.DB.Where("douyin_openid = ?", openid).First(&user)
    
    if result.Error != nil {
        // 用户不存在，创建新用户
        user = model.User{
            Platform: "douyin",
            DouyinOpenID: openid,
            DouyinUnionID: unionid,
            OpenID: openid,
            UnionID: unionid,
        }
        database.DB.Create(&user)
    }
    
    // 3. 生成 JWT token
    token := generateToken(user.ID)
    
    c.JSON(200, gin.H{
        "token": token,
        "userInfo": user,
    })
}
```

### 4. 获取用户信息

```javascript
// 小程序端 - 获取用户信息（需用户授权）
tt.getUserInfo({
  success(res) {
    const { nickName, avatarUrl, gender, city, province, country } = res.userInfo;
    
    // 发送给后端更新用户信息
    tt.request({
      url: 'https://your-api.com/api/v1/user/update',
      method: 'PUT',
      header: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        douyinNickname: nickName,
        douyinAvatar: avatarUrl,
        douyinGender: gender,
        douyinCity: city,
        douyinProvince: province,
        douyinCountry: country
      }
    });
  }
});
```

### 5. 抖音开放平台 API 文档

- 官方文档：https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/api/open-interface/user-information/tt-login
- 用户信息：https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/api/open-interface/user-information/tt-get-user-info

## 微信小程序对接

类似抖音，微信小程序登录流程：

1. 调用 `wx.login()` 获取 code
2. 后端使用 code 换取 openid 和 session_key
3. 调用 `wx.getUserProfile()` 获取用户信息
4. 存储到 `wechat_openid`、`wechat_unionid` 等字段

## 前端使用示例

### 创建用户

```typescript
import { reqCreateUser } from '@/api/user';

// 创建抖音用户
const createDouyinUser = async () => {
  const userData = {
    nickname: '用户昵称',
    avatar: 'https://example.com/avatar.jpg',
    platform: 'douyin',
    openid: 'douyin_openid_xxx',
    douyinOpenid: 'douyin_openid_xxx',
    douyinNickname: '抖音昵称',
    douyinGender: 1,
    role: 'user',
    isActive: true,
  };
  
  try {
    const user = await reqCreateUser(userData);
    console.log('用户创建成功', user);
  } catch (error) {
    console.error('创建失败', error);
  }
};
```

### 查询用户列表

```typescript
import { reqGetUserList } from '@/api/user';

// 查询抖音平台的管理员
const getDouyinAdmins = async () => {
  const result = await reqGetUserList({
    page: 1,
    pageSize: 20,
    platform: 'douyin',
    role: 'admin',
  });
  
  console.log('抖音管理员列表', result.list);
};
```

## 注意事项

1. **数据迁移**：在部署前需要执行 `migrations/001_update_users_table.sql` 更新数据库表结构
2. **索引优化**：已为常用查询字段创建索引，提高查询性能
3. **平台标识**：`platform` 字段用于区分不同平台，`openid` 和 `unionid` 是通用字段
4. **隐私保护**：注意保护用户隐私信息，敏感字段应加密存储
5. **权限控制**：所有管理接口都需要 admin 权限，通过 middleware 进行验证

## 后续扩展

- [ ] 添加用户批量导入功能
- [ ] 添加用户数据导出功能
- [ ] 集成短信验证功能
- [ ] 添加用户标签管理
- [ ] 实现用户分组功能

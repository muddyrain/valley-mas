# Valley MAS 小程序端

## 📱 技术栈

- **框架**: Taro 4 + React 18
- **样式**: Tailwind CSS（所有样式使用 Tailwind 类名）
- **状态管理**: React Hooks (useState, useEffect)
- **类型**: TypeScript

## 🎨 样式规范

### Tailwind CSS 使用

本项目**完全使用 Tailwind CSS**，不使用传统的 SCSS/CSS 文件。

#### 常用类名示例

```tsx
// 布局
<View className="flex items-center justify-between">
<View className="grid grid-cols-2 gap-4">

// 间距
<View className="px-4 py-3 mt-2 mb-4">

// 颜色
<Text className="text-gray-400 bg-purple-500">
<View className="bg-white text-black">

// 圆角和阴影
<View className="rounded-lg shadow-sm">
<Image className="rounded-full">

// 字体
<Text className="text-sm font-medium">
<Text className="text-lg font-bold">
```

#### 响应式布局

```tsx
// 两列布局
<View className="w-1/2 px-2">

// 横向滚动
<ScrollView className="whitespace-nowrap" scrollX>
```

## 📄 页面说明

### 首页 (pages/home/index.tsx)

#### 功能模块

1. **顶部搜索栏**
   - 输入创作者口令
   - 点击搜索跳转到创作者空间

2. **热门创作者**
   - 横向滚动展示
   - 显示创作者头像、名称、下载量
   - 点击查看创作者详情

3. **精选资源**
   - 两列瀑布流布局
   - 显示资源缩略图、标题、创作者、下载量
   - 点击查看资源详情

4. **上拉加载更多**
   - 触底自动加载
   - 加载状态提示

#### 数据类型

```typescript
interface Creator {
  id: string;
  name: string;
  avatar: string;
  resourceCount: number;
  downloadCount: number;
}

interface Resource {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  type: 'avatar' | 'wallpaper';
  downloadCount: number;
  creatorName?: string;
}
```

#### 核心功能

```typescript
// 搜索口令
const handleSearch = () => {
  // 验证口令并跳转
  Taro.navigateTo({
    url: `/pages/creator/space?code=${searchCode}`,
  });
};

// 查看创作者
const viewCreator = (creator: Creator) => {
  Taro.navigateTo({
    url: `/pages/creator/detail?id=${creator.id}`,
  });
};

// 查看资源
const viewResource = (resource: Resource) => {
  Taro.navigateTo({
    url: `/pages/resource/detail?id=${resource.id}`,
  });
};

// 加载更多
const loadMore = () => {
  // 上拉加载更多资源
};
```

## 🚀 开发指南

### 启动开发

```bash
# 微信小程序
pnpm dev:mini

# H5 预览
pnpm dev:h5
```

### 构建

```bash
# 构建微信小程序
pnpm build:mini

# 构建 H5
pnpm build:h5
```

## 📋 待实现功能

### 首页
- [x] 搜索栏 UI
- [x] 热门创作者展示
- [x] 精选资源瀑布流
- [x] 上拉加载更多
- [ ] 下拉刷新
- [ ] 接入真实 API
- [ ] 筛选功能
- [ ] 搜索历史

### 其他页面
- [ ] 创作者空间页 (pages/creator/space)
- [ ] 创作者详情页 (pages/creator/detail)
- [ ] 资源详情页 (pages/resource/detail)
- [ ] 发现页 (pages/discover/index)
- [ ] 个人中心 (pages/mine/index)

## 🔌 API 集成

### 待对接接口

```typescript
// 获取热门创作者
GET /api/v1/public/creators/hot

// 获取精选资源
GET /api/v1/public/resources/featured

// 验证创作者口令
GET /api/v1/public/space/:code

// 搜索资源
GET /api/v1/public/resources/search?keyword=xxx
```

## 🎯 下一步计划

1. **接入真实 API**
   - 封装 API 请求方法
   - 替换 Mock 数据

2. **完善创作者空间页**
   - 显示空间信息
   - 展示资源列表
   - 实现资源下载

3. **实现资源详情页**
   - 大图预览
   - 下载按钮
   - 观看广告解锁

4. **个人中心**
   - 我的下载记录
   - 用户设置

## 📝 注意事项

### Tailwind 在小程序中的限制

1. **不支持的类名**
   - `hover:` 前缀（小程序没有 hover）
   - `group-` 相关类名
   - 某些复杂的伪类

2. **推荐使用**
   - 基础布局类：`flex`, `grid`, `w-`, `h-`
   - 间距类：`p-`, `m-`, `gap-`
   - 颜色类：`bg-`, `text-`
   - 圆角阴影：`rounded-`, `shadow-`

3. **性能优化**
   - 避免过深的嵌套
   - 合理使用 `mode` 属性（Image 组件）
   - 长列表使用虚拟滚动

### 图片处理

```tsx
// 使用占位图
<Image 
  src={url || 'https://via.placeholder.com/400'}
  className="w-full h-48 bg-gray-200"
  mode="aspectFill"
/>

// 图片懒加载
<Image 
  src={url}
  lazyLoad
  mode="aspectFill"
/>
```

## 🐛 常见问题

### Tailwind 类名不生效

确保 `tailwind.config.js` 中的 `content` 配置正确：

```js
content: ['./src/**/*.{html,js,ts,jsx,tsx}']
```

### 小程序 API 调用失败

检查 `project.config.json` 中的域名配置：

```json
{
  "setting": {
    "urlCheck": false  // 开发时关闭域名校验
  }
}
```

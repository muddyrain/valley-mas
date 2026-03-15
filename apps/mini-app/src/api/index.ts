import http from '../utils/request';

// API 接口返回的基础类型
interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

// 用户相关接口
export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  vipLevel: number;
  vipExpireTime: string;
  createTime: string;
}

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  userInfo: User;
}

// 创作者相关接口
export interface Creator {
  id: string;
  name: string;
  avatar: string;
  resourceCount: number;
  downloadCount: number;
  description?: string;
  createTime: string;
}

// 资源相关接口
export interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'avatar' | 'wallpaper';
  downloadCount: number;
  creatorName?: string;
  creatorId?: string;
  createTime: string;
  tags?: string[];
}

// 分页参数
export interface PaginationParams {
  page: number;
  pageSize: number;
}

// 分页响应
export interface PaginationResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 用户相关 API
export const userApi = {
  // 登录
  login: (params: LoginParams) => http.post<LoginResponse>('/auth/login', params),

  // 刷新令牌
  refreshToken: (refreshToken: string) =>
    http.post<{ token: string; refreshToken: string }>('/auth/refresh', { refreshToken }),

  // 获取用户信息
  getUserInfo: () => http.get<User>('/user/info'),

  // 更新用户信息
  updateUserInfo: (params: Partial<User>) => http.put<User>('/user/info', params),

  // 上传头像
  uploadAvatar: (filePath: string) => http.upload<{ url: string }>('/user/avatar', filePath),
};

// 创作者相关 API
export const creatorApi = {
  // 获取热门创作者
  getHotCreators: (params?: PaginationParams) =>
    http.get<PaginationResponse<Creator>>('/public/hot-creators', params),

  // 获取创作者详情
  getCreatorDetail: (id: string) => http.get<Creator>(`/creator/${id}`),

  // 搜索创作者
  searchCreators: (keyword: string, params?: PaginationParams) =>
    http.get<PaginationResponse<Creator>>('/creator/search', { keyword, ...params }),

  // 通过口令查找创作者
  getCreatorByCode: (code: string) => http.get<Creator>('/creator/by-code', { code }),
};

// 资源相关 API
export const resourceApi = {
  // 获取精选资源
  getFeaturedResources: (params?: PaginationParams) =>
    http.get<PaginationResponse<Resource>>('/resource/featured', params),

  // 获取资源详情
  getResourceDetail: (id: string) => http.get<Resource>(`/resource/${id}`),

  // 搜索资源
  searchResources: (
    params: {
      keyword?: string;
      type?: 'avatar' | 'wallpaper';
      tags?: string[];
    } & PaginationParams,
  ) => http.get<PaginationResponse<Resource>>('/resource/search', params),

  // 获取创作者的资源
  getResourcesByCreator: (creatorId: string, params?: PaginationParams) =>
    http.get<PaginationResponse<Resource>>(`/resource/creator/${creatorId}`, params),

  // 下载资源
  downloadResource: (id: string) => http.post<{ downloadUrl: string }>(`/resource/${id}/download`),

  // 上传资源
  uploadResource: (
    filePath: string,
    params: {
      title: string;
      type: 'avatar' | 'wallpaper';
      tags?: string[];
    },
  ) => http.upload<Resource>('/resource/upload', filePath, params),
};

// 订单相关 API
export interface Order {
  id: string;
  orderNo: string;
  type: 'vip' | 'resource';
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  createTime: string;
  payTime?: string;
}

export const orderApi = {
  // 创建订单
  createOrder: (params: { type: 'vip' | 'resource'; resourceId?: string; vipLevel?: number }) =>
    http.post<Order>('/order/create', params),

  // 获取订单列表
  getOrders: (params?: PaginationParams) =>
    http.get<PaginationResponse<Order>>('/order/list', params),

  // 获取订单详情
  getOrderDetail: (id: string) => http.get<Order>(`/order/${id}`),

  // 取消订单
  cancelOrder: (id: string) => http.post(`/order/${id}/cancel`),
};

// 通用 API
export const commonApi = {
  // 获取标签列表
  getTags: () => http.get<string[]>('/common/tags'),

  // 上传文件
  uploadFile: (filePath: string) => http.upload<{ url: string }>('/common/upload', filePath),

  // 提交反馈
  submitFeedback: (params: { content: string; contact?: string; images?: string[] }) =>
    http.post('/common/feedback', params),

  // 获取配置信息
  getConfig: () => http.get<Record<string, any>>('/common/config'),
};

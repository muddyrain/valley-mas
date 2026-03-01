import type { DouyinGender, PaginationParams, PaginationResponse, Platform, UserRole } from '../types/api';
import http from '../utils/request';

// 用户接口定义 - 支持多平台
// ID 使用 Snowflake 算法生成（int64），和抖音、字节跳动保持一致
export interface User {
  id: number; // Snowflake ID (int64)
  nickname: string;
  avatar: string;
  platform: Platform; // 平台类型
  openid: string;
  unionid: string;

  // 抖音平台特有字段
  douyinOpenid?: string;
  douyinUnionid?: string;
  douyinAvatar?: string;
  douyinNickname?: string;
  douyinGender?: DouyinGender; // 0-未知 1-男 2-女
  douyinCity?: string;
  douyinProvince?: string;
  douyinCountry?: string;

  // 微信平台特有字段
  wechatOpenid?: string;
  wechatUnionid?: string;

  role: UserRole;
  isActive: boolean;
  phone?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserListParams extends PaginationParams {
  keyword?: string;
  platform?: string; // 按平台筛选
  role?: string; // 按角色筛选
}

export type UserListResponse = PaginationResponse<User>;

// 获取用户列表
export const reqGetUserList = (params: UserListParams) => {
  return http.get<unknown, UserListResponse>('/admin/users', { params });
};

// 创建用户
export const reqCreateUser = (data: Partial<User>) => {
  return http.post<unknown, User>('/admin/users', data);
};

// 获取用户详情
export const reqGetUserDetail = (id: number) => {
  return http.get<unknown, User>(`/admin/users/${id}`);
};

// 更新用户
export const reqUpdateUser = (id: number, data: Partial<User>) => {
  return http.put<unknown, User>(`/admin/users/${id}`, data);
};

// 更新用户状态
export const reqUpdateUserStatus = (id: number, isActive: boolean) => {
  return http.put<unknown, null>(`/admin/users/${id}/status`, { isActive });
};

// 删除用户
export const reqDeleteUser = (id: number) => {
  return http.delete<unknown, null>(`/admin/users/${id}`);
};

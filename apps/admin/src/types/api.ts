// API 通用类型定义

// 分页参数
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// 分页响应
export interface PaginationResponse<T> {
  list: T[];
  total: number;
}

// 平台类型
export type Platform = 'wechat' | 'douyin' | 'mini_app';

// 用户角色
export type UserRole = 'user' | 'admin' | 'creator';

// 抖音用户性别
export enum DouyinGender {
  Unknown = 0,
  Male = 1,
  Female = 2,
}

// 抖音用户信息（来自开放平台）
export interface DouyinUserInfo {
  openid: string;
  unionid?: string;
  nickname?: string;
  avatar?: string;
  gender?: DouyinGender;
  city?: string;
  province?: string;
  country?: string;
}

// 微信用户信息（来自开放平台）
export interface WechatUserInfo {
  openid: string;
  unionid?: string;
  nickname?: string;
  avatar?: string;
  gender?: number;
  city?: string;
  province?: string;
  country?: string;
  language?: string;
}

// 通用响应状态
export interface ApiStatus {
  success: boolean;
  message?: string;
}

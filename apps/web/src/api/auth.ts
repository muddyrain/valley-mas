import http from '@/utils/request';

// 用户类型
export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  role: string;
}

// 登录响应
interface LoginResponse {
  token: string;
  userInfo: User;
}

// 登录
export const login = async (data: { username: string; password: string }) => {
  const res = await http.post<unknown, LoginResponse>('/login', data);
  return res;
};

// 注册
export const register = async (data: { username: string; password: string; nickname?: string }) => {
  const res = await http.post<unknown, LoginResponse>('/register', data);
  return res;
};

// 登出
export const logout = async () => {
  return http.post<void>('/logout');
};

// 获取当前用户信息
export const getCurrentUser = () => {
  return http.get<unknown, User>('/user/current');
};

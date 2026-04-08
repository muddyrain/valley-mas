import http from '../utils/request';

// 登录请求参数
export interface LoginParams {
  email: string;
  password?: string;
  verificationCode?: string;
  loginType?: 'code' | 'password';
}

// 登录响应
export interface LoginResponse {
  token: string;
  userInfo: {
    id: number;
    username: string;
    nickname: string;
    avatar: string;
    role: string;
    email?: string;
    phone?: string;
  };
}

// 当前用户信息
export interface CurrentUser {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  role: string;
  email?: string;
  phone?: string;
}

// 登录
export const reqLogin = (data: LoginParams) => {
  return http.post<unknown, LoginResponse>('/login', data);
};

export const reqSendEmailCode = (data: { email: string; purpose: 'login' | 'register' }) => {
  return http.post<unknown, { message: string }>('/email-code/send', data);
};

// 获取当前用户信息
export const reqGetCurrentUser = () => {
  return http.get<unknown, CurrentUser>('/user/current');
};

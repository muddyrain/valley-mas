import { apiRequest } from './client';

export interface DesktopUser {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  role: string;
  email?: string;
  phone?: string;
}

interface LoginResponse {
  token: string;
  userInfo: DesktopUser;
}

export function loginWithPassword(email: string, password: string) {
  return apiRequest<LoginResponse>('/login', {
    method: 'POST',
    body: {
      email,
      password,
      loginType: 'password',
    },
  });
}

export function getCurrentUser(token: string) {
  return apiRequest<DesktopUser>('/user/current', { token });
}

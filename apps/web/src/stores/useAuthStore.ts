import Cookies from 'js-cookie';
import { create } from 'zustand';

// 用户信息接口
export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  role: string;
}

// Store 接口
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  initAuth: () => void;
}

// Cookie 配置
const TOKEN_KEY = 'valley_token';
const USER_KEY = 'valley_user';
const COOKIE_EXPIRES = 7; // 7天

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  // 设置认证信息
  setAuth: (user: User, token: string) => {
    // 保存到 Cookie
    Cookies.set(TOKEN_KEY, token, { expires: COOKIE_EXPIRES });
    Cookies.set(USER_KEY, JSON.stringify(user), { expires: COOKIE_EXPIRES });

    set({
      user,
      token,
      isAuthenticated: true,
    });
  },

  // 退出登录
  logout: () => {
    // 清除 Cookie
    Cookies.remove(TOKEN_KEY);
    Cookies.remove(USER_KEY);

    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  // 初始化认证状态（从 Cookie 恢复）
  initAuth: () => {
    const token = Cookies.get(TOKEN_KEY);
    const userStr = Cookies.get(USER_KEY);

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({
          user,
          token,
          isAuthenticated: true,
        });
      } catch (error) {
        console.error('Failed to parse user from cookie:', error);
        // 清除无效的 Cookie
        Cookies.remove(TOKEN_KEY);
        Cookies.remove(USER_KEY);
      }
    }
  },
}));

import { create } from 'zustand';
import { type DesktopUser, getCurrentUser, loginWithPassword } from '../api/auth';

const AUTH_STORAGE_KEY = 'desktop-os-auth-token';

interface AuthStore {
  token: string | null;
  user: DesktopUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadCurrentUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  token: window.localStorage.getItem(AUTH_STORAGE_KEY),
  user: null,
  isLoading: false,
  error: null,
  isAuthenticated: Boolean(window.localStorage.getItem(AUTH_STORAGE_KEY)),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await loginWithPassword(email, password);
      window.localStorage.setItem(AUTH_STORAGE_KEY, result.token);
      set({
        token: result.token,
        user: result.userInfo,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '登录失败',
      });
      throw error;
    }
  },

  logout: () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    set({ token: null, user: null, isAuthenticated: false, error: null, isLoading: false });
  },

  loadCurrentUser: async () => {
    const token = get().token;
    if (!token) return;
    set({ isLoading: true, error: null });
    try {
      const user = await getCurrentUser(token);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : '登录状态已失效',
      });
    }
  },

  clearError: () => set({ error: null }),
}));

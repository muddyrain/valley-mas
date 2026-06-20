import { create } from 'zustand';
import {
  type DesktopUser,
  type DesktopUserProfileInput,
  getUserInfo,
  loginWithPassword,
  updateUserProfile,
  uploadAvatar as uploadAvatarRequest,
} from '../api/auth';

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
  saveProfile: (profile: DesktopUserProfileInput) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
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
      const user = await getUserInfo(token);
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

  saveProfile: async (profile) => {
    const token = get().token;
    if (!token) throw new Error('未登录');

    set({ isLoading: true, error: null });
    try {
      const updated = await updateUserProfile(profile, token);
      set((state) => ({
        user: state.user ? { ...state.user, ...updated } : updated,
        isAuthenticated: true,
        isLoading: false,
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '保存失败',
      });
      throw error;
    }
  },

  uploadAvatar: async (file) => {
    const token = get().token;
    if (!token) throw new Error('未登录');

    set({ isLoading: true, error: null });
    try {
      const result = await uploadAvatarRequest(file, token);
      set((state) => ({
        user: state.user ? { ...state.user, avatar: result.avatarUrl } : state.user,
        isAuthenticated: true,
        isLoading: false,
      }));
      return result.avatarUrl;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '上传失败',
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

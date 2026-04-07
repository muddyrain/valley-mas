import Cookies from 'js-cookie';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { getMyProfile, refreshToken as refreshSessionToken, type UserProfile } from '@/api/auth';

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
  /** persist 水合是否完成（防止水合前误判 isAuthenticated=false） */
  hasHydrated: boolean;
  /** 详细用户资料（含 email/phone/downloadCount 等），懒加载，不持久化 */
  profile: UserProfile | null;
  profileLoading: boolean;

  // Actions
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  /** @deprecated persist 中间件自动恢复状态，保留此方法仅用于兼容旧调用 */
  initAuth: () => void;
  /** 从接口拉取并缓存 profile（已有则跳过，force=true 强制刷新） */
  fetchProfile: (force?: boolean) => Promise<void>;
  /** 直接更新本地 profile 缓存（用于保存成功后同步） */
  setProfile: (profile: UserProfile) => void;
}

// ---------- 自定义 Cookie Storage（适配 zustand persist） ----------
const COOKIE_KEY = 'valley_auth';
const COOKIE_EXPIRES = 7; // 天

const cookieStorage: StateStorage = {
  getItem: (name) => Cookies.get(name) ?? null,
  setItem: (name, value) => Cookies.set(name, value, { expires: COOKIE_EXPIRES, sameSite: 'Lax' }),
  removeItem: (name) => Cookies.remove(name),
};

// ---------- Store ----------
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      // Cookie storage 是同步的，模块加载时已立即水合，初始即为 true
      // 若 storage 是异步的（如 AsyncStorage），这里应设为 false
      hasHydrated: true,
      // profile 不写入持久化（见 partialize）
      profile: null,
      profileLoading: false,

      setAuth: (user, token) => {
        set({ user, token, isAuthenticated: true, profile: null });
      },

      logout: () => {
        // 清除旧版本遗留的独立 Cookie key（向前兼容）
        Cookies.remove('valley_token');
        Cookies.remove('valley_user');
        set({ user: null, token: null, isAuthenticated: false, profile: null });
      },

      // 兼容旧调用（persist 已自动恢复，什么都不做）
      initAuth: () => {},

      fetchProfile: async (force = false) => {
        const { profile, profileLoading, isAuthenticated } = get();
        if (!isAuthenticated) return;
        if (!force && profile) return;
        if (profileLoading) return;
        try {
          set({ profileLoading: true });
          const data = await getMyProfile();
          // 同步 user 的基础字段（nickname/avatar/role 可能变更）
          const { user } = get();
          if (user) {
            set({
              profile: data,
              user: { ...user, nickname: data.nickname, avatar: data.avatar, role: data.role },
            });
          } else {
            set({ profile: data });
          }

          if (force) {
            try {
              const session = await refreshSessionToken();
              set((state) => {
                const nextUser = state.user
                  ? { ...state.user, ...session.userInfo }
                  : session.userInfo;

                return {
                  token: session.token,
                  user: nextUser,
                  ...(state.profile && {
                    profile: {
                      ...state.profile,
                      nickname: nextUser.nickname,
                      avatar: nextUser.avatar,
                      role: nextUser.role,
                    },
                  }),
                };
              });
            } catch {
              // token refresh failure should not block profile refresh
            }
          }
        } catch {
          // 静默失败，不影响页面
        } finally {
          set({ profileLoading: false });
        }
      },

      setProfile: (profile) => {
        const { user } = get();
        set({
          profile,
          // 同步 user 基础字段，persist 会自动将更新后的 user 写入 Cookie
          ...(user && {
            user: {
              ...user,
              nickname: profile.nickname,
              avatar: profile.avatar,
              role: profile.role,
            },
          }),
        });
      },
    }),
    {
      name: COOKIE_KEY,
      storage: createJSONStorage(() => cookieStorage),
      // 只持久化登录凭证，profile 是运行时缓存不需要持久化
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (_state, error) => {
        // 用 setState 正确触发响应式更新（直接赋值不会通知订阅者）
        if (!error) useAuthStore.setState({ hasHydrated: true });
      },
    },
  ),
);

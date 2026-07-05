import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LifeTraceUser } from '@/api/auth';
import {
  getCurrentUser,
  isConfirmedAuthFailure,
  loginWithCode,
  loginWithPassword,
  registerWithEmail,
  logout as requestLogout,
} from '@/api/auth';

type AuthStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated';

type AuthState = {
  token: string | null;
  user: LifeTraceUser | null;
  status: AuthStatus;
  error: string;
  setError: (error: string) => void;
  updateUser: (
    updater: Partial<LifeTraceUser> | ((current: LifeTraceUser | null) => LifeTraceUser | null),
  ) => void;
  signIn: (input: { email: string; password: string; verificationCode?: string }) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    verificationCode: string;
    nickname?: string;
  }) => Promise<void>;
  verifySession: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      status: 'idle',
      error: '',
      setError: (error) => set({ error }),
      updateUser: (updater) =>
        set((state) => {
          const nextUser =
            typeof updater === 'function'
              ? updater(state.user)
              : state.user
                ? { ...state.user, ...updater }
                : null;

          return { user: nextUser };
        }),
      signIn: async (input) => {
        set({ error: '' });
        try {
          const result = input.verificationCode
            ? await loginWithCode({ email: input.email, verificationCode: input.verificationCode })
            : await loginWithPassword({ email: input.email, password: input.password });
          set({ token: result.token, user: result.userInfo, status: 'authenticated', error: '' });
        } catch (error) {
          set({
            token: null,
            user: null,
            status: get().token ? 'idle' : 'unauthenticated',
            error: error instanceof Error ? error.message : '登录失败',
          });
          throw error;
        }
      },
      signUp: async (input) => {
        set({ error: '' });
        try {
          const { token, userInfo } = await registerWithEmail(input);
          set({ token, user: userInfo, status: 'authenticated', error: '' });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '注册失败',
          });
          throw error;
        }
      },
      verifySession: async () => {
        const { token } = get();
        if (!token) {
          set({ user: null, status: 'unauthenticated' });
          return;
        }

        set({ status: 'checking', error: '' });
        try {
          const user = await getCurrentUser(token);
          set({ user, status: 'authenticated', error: '' });
        } catch (error) {
          if (isConfirmedAuthFailure(error)) {
            set({ token: null, user: null, status: 'unauthenticated', error: '' });
            return;
          }
          set({ status: 'authenticated', error: '暂时无法验证登录状态，请稍后重试' });
        }
      },
      signOut: async () => {
        const { token } = get();
        set({ token: null, user: null, status: 'unauthenticated', error: '' });
        if (!token) {
          return;
        }

        try {
          await requestLogout(token);
        } catch {
          // Local sign-out should still succeed when the server session is already invalid.
        }
      },
    }),
    {
      name: 'life-trace-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.status = state.token ? 'idle' : 'unauthenticated';
        }
      },
    },
  ),
);

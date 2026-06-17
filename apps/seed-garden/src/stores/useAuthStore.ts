import { create } from 'zustand';

interface AuthState {
  token: string | null;
  setToken: (t: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('seed_garden_token') : null,
  setToken: (token) => {
    if (token) localStorage.setItem('seed_garden_token', token);
    else localStorage.removeItem('seed_garden_token');
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('seed_garden_token');
    set({ token: null });
  },
}));

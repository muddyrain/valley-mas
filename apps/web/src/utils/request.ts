import { type ApiResponse, createHttpClient, type RequestConfig } from '@valley/shared-request';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';

export type { ApiResponse, RequestConfig };

const GLOBAL_ERROR_TOAST_ID = 'global-error-toast';

const showLatestErrorToast = (message: string) => {
  toast.error(message, { id: GLOBAL_ERROR_TOAST_ID });
};

const redirectToLogin = () => {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

const http = createHttpClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 60000,
  withCredentials: true,
  getToken: () => useAuthStore.getState().token,
  clearAuth: () => {
    useAuthStore.getState().logout();
    localStorage.removeItem('admin_token');
    localStorage.removeItem('userInfo');
  },
  redirectToLogin,
  showError: (message) => {
    showLatestErrorToast(message);
  },
});

export default http;

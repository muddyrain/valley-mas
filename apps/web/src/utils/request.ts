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

// 页面会根据当前操作提供具体的错误提示。默认抑制请求层 toast，避免同一失败
// 被全局拦截器和页面 catch 重复展示；确实需要兜底提示时可显式传入 false。
http.interceptors.request.use((config) => {
  const requestConfig = config as typeof config & RequestConfig;
  if (requestConfig.suppressErrorToast === undefined) {
    requestConfig.suppressErrorToast = true;
  }
  return config;
});

export default http;

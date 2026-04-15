import {
  type ApiResponse,
  createHttpClient,
  type ErrorMessageResolver,
  type RequestConfig,
} from '@valley/shared-request';
import { message } from 'antd';

export type { ApiResponse, RequestConfig };

const redirectToLogin = () => {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

const resolveErrorMessage: ErrorMessageResolver = (error, fallback) => {
  const axiosError = error as {
    response?: { status?: number; data?: { message?: string } };
    code?: string;
  };
  const status = axiosError.response?.status;

  if (status === 401) return '认证失败，请重新登录';
  if (status === 403) return '您没有权限执行此操作';
  if (status === 404) return '请求的资源不存在';
  if (status === 500) return '服务器内部错误';
  if (status === 502) return '网关错误';
  if (status === 503) return '服务暂时不可用';
  if (status && status >= 500) return '服务器端发生错误';

  if (!status) {
    if (axiosError.code === 'ECONNABORTED') return '请求超时，请检查网络连接';
    if (axiosError.code === 'ERR_NETWORK') return '网络连接失败，请检查网络';
    return '网络请求失败，请稍后重试';
  }

  return fallback;
};

const http = createHttpClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  withCredentials: true,
  getToken: () => localStorage.getItem('admin_token'),
  clearAuth: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('userInfo');
  },
  redirectToLogin,
  resolveErrorMessage,
  showError: (msg) => {
    message.error(msg);
  },
});

export default http;

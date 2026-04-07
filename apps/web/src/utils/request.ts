import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface RequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
  suppressErrorToast?: boolean;
}

const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 60000,
  withCredentials: true,
});

const GLOBAL_ERROR_TOAST_ID = 'global-error-toast';

const showLatestErrorToast = (message: string) => {
  toast.error(message, { id: GLOBAL_ERROR_TOAST_ID });
};

http.interceptors.request.use(
  (config) => {
    const requestConfig = config as typeof config & RequestConfig;
    const token = useAuthStore.getState().token;

    if (requestConfig.skipAuth) {
      if (requestConfig.headers?.Authorization) {
        delete requestConfig.headers.Authorization;
      }
      return requestConfig;
    }

    if (token) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }

    return requestConfig;
  },
  (error) => {
    const requestConfig = error.config as RequestConfig | undefined;
    if (!requestConfig?.suppressErrorToast) {
      showLatestErrorToast('请求失败，请稍后重试');
    }
    return Promise.reject(error);
  },
);

http.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { code, message: msg, data } = response.data;
    if (code !== 0) {
      if (code === 401) {
        useAuthStore.getState().logout();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      showLatestErrorToast(msg || '请求失败');
      return Promise.reject(new Error(msg || 'Error'));
    }

    return data as typeof response;
  },
  (error) => {
    console.error('API Error:', error);
    const requestConfig = error.config as RequestConfig | undefined;

    const status = error.response?.status;
    const responseData = error.response?.data;
    let msg = error.message;

    if (status === 401) {
      msg = '认证失败，请重新登录';
      localStorage.removeItem('admin_token');
      localStorage.removeItem('userInfo');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (status === 403) {
      msg = '您没有权限执行此操作';
    } else if (status === 404) {
      msg = '请求的资源不存在';
    } else if (status === 500) {
      msg = '服务器内部错误';
    } else if (status === 502) {
      msg = '网关错误';
    } else if (status === 503) {
      msg = '服务暂时不可用';
    } else if (status >= 500) {
      msg = '服务端发生错误';
    } else if (!status) {
      if (error.code === 'ECONNABORTED') {
        msg = '请求超时，请检查网络连接';
      } else if (error.code === 'ERR_NETWORK') {
        msg = '网络连接失败，请检查网络';
      } else {
        msg = '网络请求失败，请稍后重试';
      }
    }

    if (responseData?.message) {
      msg = responseData.message;
    }

    if (!requestConfig?.suppressErrorToast) {
      showLatestErrorToast(msg);
    }
    return Promise.reject(error);
  },
);

export default http;

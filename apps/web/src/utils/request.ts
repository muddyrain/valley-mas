import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface RequestConfig {
  skipAuth?: boolean;
}

const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 10000,
  withCredentials: true,
});

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
    toast.error('请求失败，请稍后重试');
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
      toast.error(msg || '请求失败');
      return Promise.reject(new Error(msg || 'Error'));
    }

    return data as typeof response;
  },
  (error) => {
    console.error('API Error:', error);

    const status = error.response?.status;
    const responseData = error.response?.data;
    let errorMessage = '请求失败，请稍后重试';

    if (responseData?.message) {
      errorMessage = responseData.message;
    } else if (status === 401) {
      errorMessage = '认证失败，请重新登录';
      useAuthStore.getState().logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (status === 403) {
      errorMessage = '您没有权限执行此操作';
    } else if (status === 404) {
      errorMessage = '请求的资源不存在';
    } else if (status === 500) {
      errorMessage = '服务器内部错误';
    } else if (status === 502) {
      errorMessage = '网关错误';
    } else if (status === 503) {
      errorMessage = '服务暂时不可用';
    } else if (status && status >= 500) {
      errorMessage = '服务器错误';
    } else if (!status) {
      if (error.code === 'ECONNABORTED') {
        errorMessage = '请求超时，请检查网络连接';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = '网络连接失败，请检查网络';
      } else {
        errorMessage = '网络请求失败，请稍后重试';
      }
    }

    toast.error(errorMessage);
    return Promise.reject(error);
  },
);

export default http;

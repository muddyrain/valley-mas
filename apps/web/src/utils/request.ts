import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';

// 定义接口返回的标准结构
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

// 创建 axios 实例
const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 10000,
  withCredentials: true, // 允许携带 Cookie
});

// 请求拦截器
http.interceptors.request.use(
  (config) => {
    // 直接从 Zustand store 的 getState() 取 token，避免手动解析 Cookie
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    toast.error('请求失败，请稍后重试');
    return Promise.reject(error);
  },
);

// 响应拦截器
http.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { code, message: msg, data } = response.data;

    // 假设非 0 均为错误情况，具体看后端约定
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

    return data as typeof response; // 直接返回 data 部分
  },
  (error) => {
    console.error('API Error:', error);

    const status = error.response?.status;
    const responseData = error.response?.data;
    let errorMessage = '请求失败，请稍后重试';

    // 优先使用后端返回的错误信息
    if (responseData?.message) {
      errorMessage = responseData.message;
    } else if (status === 401) {
      errorMessage = '认证失败，请重新登录';
      // 调用 store logout，清除所有认证状态和 Cookie
      useAuthStore.getState().logout();

      // 避免在登录页重复跳转
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
      // 网络错误或请求被取消
      if (error.code === 'ECONNABORTED') {
        errorMessage = '请求超时，请检查网络连接';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = '网络连接失败，请检查网络';
      } else {
        errorMessage = '网络请求失败，请稍后重试';
      }
    }

    // 显示错误提示
    toast.error(errorMessage);

    return Promise.reject(error);
  },
);

export default http;

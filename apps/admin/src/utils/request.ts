import { message } from 'antd';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';

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
    // Token 现在通过 Cookie 自动发送，无需手动设置
    // 保留此拦截器以便后续扩展其他功能
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 响应拦截器
http.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { code, message: msg, data } = response.data;

    // 假设非 0 均为错误情况，具体看后端约定
    if (code !== 0) {
      message.error(msg || '请求失败');
      return Promise.reject(new Error(msg || 'Error'));
    }

    return data as typeof response; // 直接返回 data 部分
  },
  (error) => {
    console.error('API Error:', error);

    const status = error.response?.status;
    const responseData = error.response?.data;
    let msg = error.message;
    console.log(status);
    // 优先使用后端返回的错误信息
    if (status === 401) {
      msg = '认证失败，请重新登录';
      // Token 已过期或无效，跳转到登录页
      // 不需要清除 Cookie，因为 Cookie 会由服务器清除或自动过期
      localStorage.removeItem('userInfo'); // 清除本地用户信息
      // 避免在登录页重复跳转
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
      msg = '服务器端发生错误';
    } else if (!status) {
      // 网络错误或请求被取消
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
    // 显示错误提示
    message.error(msg);
    return Promise.reject(error);
  },
);

export default http;

import Taro from '@tarojs/taro';
import { envConfig } from '../config/env';

// API 基础路径
const BASE_URL = envConfig.baseURL;

// 请求配置
const DEFAULT_CONFIG = {
  timeout: 15000, // 15秒超时
  header: {
    'Content-Type': 'application/json',
  },
};

// 错误码映射
const ERROR_CODE_MAP: Record<number, string> = {
  400: '请求参数错误',
  401: '未授权，请重新登录',
  403: '拒绝访问',
  404: '请求资源不存在',
  408: '请求超时',
  500: '服务器内部错误',
  502: '网关错误',
  503: '服务不可用',
  504: '网关超时',
};

// 请求队列，用于处理并发请求
let requestQueue: any[] = [];
let isRefreshing = false;

// 获取 token
const getToken = (): string | null => {
  return Taro.getStorageSync('token') || null;
};

// 刷新 token
const refreshToken = async (): Promise<string> => {
  try {
    const refreshToken = Taro.getStorageSync('refreshToken');
    if (!refreshToken) {
      throw new Error('没有刷新令牌');
    }

    const res = await Taro.request({
      url: `${BASE_URL}/auth/refresh`,
      method: 'POST',
      data: { refreshToken },
      header: {
        'Content-Type': 'application/json',
      },
    });

    if (res.statusCode === 200 && res.data.code === 0) {
      const { token, refreshToken: newRefreshToken } = res.data.data;
      Taro.setStorageSync('token', token);
      Taro.setStorageSync('refreshToken', newRefreshToken);
      return token;
    }

    throw new Error('刷新令牌失败');
  } catch (error) {
    // 刷新失败，清除本地存储，跳转登录页
    Taro.removeStorageSync('token');
    Taro.removeStorageSync('refreshToken');
    Taro.removeStorageSync('userInfo');

    // 跳转到登录页
    Taro.reLaunch({
      url: '/pages/login/index',
    });

    throw error;
  }
};

// 处理请求错误
const handleError = (error: any, config: RequestOptions) => {
  const { statusCode, errMsg } = error;

  // 网络错误或超时
  if (!statusCode && errMsg) {
    if (errMsg.includes('timeout')) {
      Taro.showToast({
        title: '请求超时，请检查网络',
        icon: 'none',
      });
    } else if (errMsg.includes('fail')) {
      Taro.showToast({
        title: '网络连接失败，请检查网络',
        icon: 'none',
      });
    }

    return Promise.reject(error);
  }

  // HTTP 错误
  const errorMessage = ERROR_CODE_MAP[statusCode] || `请求失败: ${statusCode}`;

  if (config.showError !== false) {
    Taro.showToast({
      title: errorMessage,
      icon: 'none',
    });
  }

  return Promise.reject(error);
};

// 请求配置接口
interface RequestOptions extends Taro.request.Option {
  showError?: boolean; // 是否显示错误提示
  skipAuth?: boolean; // 跳过认证
  retry?: number; // 重试次数
}

// 主请求函数
const request = <T = any>(config: RequestOptions): Promise<T> => {
  // 合并默认配置
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    url: config.url?.startsWith('http') ? config.url : `${BASE_URL}${config.url}`,
  };

  // 添加认证头
  if (!finalConfig.skipAuth) {
    const token = getToken();
    if (token) {
      finalConfig.header = {
        ...finalConfig.header,
        Authorization: `Bearer ${token}`,
      };
    }
  }

  // 记录请求开始时间
  const startTime = Date.now();

  return new Promise<T>((resolve, reject) => {
    Taro.request({
      ...finalConfig,
      success: async (res) => {
        // 记录请求耗时
        const duration = Date.now() - startTime;
        console.log(
          `[API] ${finalConfig.method} ${finalConfig.url} - ${res.statusCode} (${duration}ms)`,
        );

        // 业务成功
        if (res.statusCode === 200) {
          // 业务逻辑成功
          if (res.data.code === 0) {
            resolve(res.data.data);
          }
          // token 过期，尝试刷新
          else if (res.data.code === 401 && !finalConfig.skipAuth) {
            // 如果正在刷新，将请求加入队列
            if (isRefreshing) {
              return new Promise((resolveQueue) => {
                requestQueue.push({
                  config: finalConfig,
                  resolve: resolveQueue,
                  reject,
                });
              })
                .then(resolve)
                .catch(reject);
            }

            isRefreshing = true;

            try {
              const newToken = await refreshToken();
              finalConfig.header = {
                ...finalConfig.header,
                Authorization: `Bearer ${newToken}`,
              };

              // 重新发送请求
              const retryRes = await Taro.request(finalConfig);
              if (retryRes.data.code === 0) {
                resolve(retryRes.data.data);

                // 处理队列中的请求
                requestQueue.forEach(({ resolve: resolveQueue }) => {
                  resolveQueue(retryRes.data.data);
                });
                requestQueue = [];
              } else {
                reject(retryRes);
              }
            } catch (refreshError) {
              // 处理队列中的请求
              requestQueue.forEach(({ reject: rejectQueue }) => {
                rejectQueue(refreshError);
              });
              requestQueue = [];
              reject(refreshError);
            } finally {
              isRefreshing = false;
            }
          }
          // 其他业务错误
          else {
            const message = res.data.message || '请求失败';
            if (finalConfig.showError !== false) {
              Taro.showToast({
                title: message,
                icon: 'none',
              });
            }
            reject(res.data);
          }
        }
        // HTTP 错误
        else {
          handleError(res, finalConfig);
        }
      },
      fail: (error) => {
        handleError(error, finalConfig);
      },
    });
  });
};

// 封装常用请求方法
export const http = {
  get: <T = any>(url: string, data?: any, config?: RequestOptions) =>
    request<T>({ url, method: 'GET', data, ...config }),

  post: <T = any>(url: string, data?: any, config?: RequestOptions) =>
    request<T>({ url, method: 'POST', data, ...config }),

  put: <T = any>(url: string, data?: any, config?: RequestOptions) =>
    request<T>({ url, method: 'PUT', data, ...config }),

  delete: <T = any>(url: string, data?: any, config?: RequestOptions) =>
    request<T>({ url, method: 'DELETE', data, ...config }),

  upload: <T = any>(url: string, filePath: string, formData?: any, config?: RequestOptions) =>
    new Promise<T>((resolve, reject) => {
      const token = getToken();
      const header: any = {};

      if (token && !config?.skipAuth) {
        header['Authorization'] = `Bearer ${token}`;
      }

      Taro.uploadFile({
        url: url.startsWith('http') ? url : `${BASE_URL}${url}`,
        filePath,
        name: 'file',
        formData,
        header,
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.code === 0) {
              resolve(data.data);
            } else {
              reject(data);
            }
          } catch (e) {
            reject(e);
          }
        },
        fail: reject,
      });
    }),
};

export default http;

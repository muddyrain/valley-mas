import Taro from '@tarojs/taro';

// 环境配置
const config = {
  // 开发环境
  development: {
    baseURL: 'http://localhost:8080/api/v1',
    env: 'development',
  },

  // 测试环境
  test: {
    baseURL: 'https://api-test.valley-mas.com',
    env: 'test',
  },

  // 生产环境
  production: {
    baseURL: 'https://api.valley-mas.com',
    env: 'production',
  },
};

// 获取当前环境
const getEnv = () => {
  // 小程序环境判断
  const accountInfo = Taro.getAccountInfoSync?.();
  if (accountInfo) {
    // 开发版
    if (accountInfo.miniProgram?.envVersion === 'develop') {
      return 'development';
    }
    // 体验版
    if (accountInfo.miniProgram?.envVersion === 'trial') {
      return 'test';
    }
    // 正式版
    if (accountInfo.miniProgram?.envVersion === 'release') {
      return 'production';
    }
  }

  // H5 环境判断
  const hostname = window?.location?.hostname;
  if (hostname) {
    if (hostname.includes('dev') || hostname.includes('localhost')) {
      return 'development';
    }
    if (hostname.includes('test')) {
      return 'test';
    }
    return 'production';
  }

  // 默认开发环境
  return 'development';
};

// 导出当前环境配置
export const envConfig = config[getEnv() as keyof typeof config];

// 导出当前环境
export const currentEnv = getEnv();

export default envConfig;

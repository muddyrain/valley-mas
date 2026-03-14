import http from '../utils/request';

// 统计数据接口
export interface StatsData {
  overview: {
    userCount: number;
    creatorCount: number;
    activeCreatorCount: number;
    resourceCount: number;
    downloadCount: number;
    accessCount: number;
  };
  resources: {
    total: number;
    avatar: number;
    wallpaper: number;
  };
  topResources: Array<{
    id: string;
    title: string;
    type: string;
    downloadCount: number;
    url: string;
  }>;
  topCreators: Array<{
    creatorId: string;
    resourceCount: number;
    creator: {
      id: string;
      code: string;
      description: string;
      user?: {
        id: string;
        nickname: string;
        avatar: string;
      };
    };
  }>;
}

// 趋势数据接口
export interface TrendsData {
  dates: string[];
  series: Array<{
    name: string;
    data: number[];
  }>;
}

// 获取统计数据
export const reqGetStats = () => {
  return http.get<unknown, StatsData>('/admin/stats');
};

// 获取趋势数据
export const reqGetTrends = () => {
  return http.get<unknown, TrendsData>('/admin/trends');
};

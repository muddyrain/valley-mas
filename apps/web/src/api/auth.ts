import http from '@/utils/request';

// 用户类型
export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  role: string;
}

// 登录响应
interface LoginResponse {
  token: string;
  userInfo: User;
}

// 登录
export const login = async (data: { username: string; password: string }) => {
  const res = await http.post<unknown, LoginResponse>('/login', data);
  return res;
};

// 注册
export const register = async (data: { username: string; password: string; nickname?: string }) => {
  const res = await http.post<unknown, LoginResponse>('/register', data);
  return res;
};

// 登出
export const logout = async () => {
  return http.post<void>('/logout');
};

// 获取当前用户信息
export const getCurrentUser = () => {
  return http.get<unknown, User>('/user/current');
};

// 获取个人详细信息（含统计数据）
export interface UserProfile extends User {
  email: string;
  phone: string;
  createdAt: string;
  downloadCount: number;
}

export interface AvatarHistoryItem {
  id: string;
  avatarUrl: string;
  createdAt: string;
}

export interface DownloadHistoryItem {
  id: string;
  userId: string;
  resourceId: string;
  creatorId: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  resource?: {
    id: string;
    title: string;
    type: string;
    url: string;
    thumbnailUrl?: string;
    size?: number;
  };
  creator?: {
    id: string;
    code: string;
    user?: {
      nickname: string;
      avatar: string;
    };
  };
}

export const getMyProfile = () => {
  return http.get<unknown, UserProfile>('/user/info');
};

// 更新个人信息
export const updateMyProfile = (data: {
  nickname?: string;
  avatar?: string;
  email?: string;
  phone?: string;
}) => {
  return http.put<unknown, User>('/user/profile', data);
};

// 修改密码
export const changePassword = (data: { oldPassword: string; newPassword: string }) => {
  return http.put<void>('/user/password', data);
};

// 上传头像，返回新头像 URL
export const uploadAvatar = (formData: FormData) => {
  return http.post<unknown, { avatarUrl: string }>('/user/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getAvatarHistory = (pageSize = 12) => {
  return http.get<unknown, AvatarHistoryItem[]>(`/user/avatar/history?pageSize=${pageSize}`);
};

export const getUseAvatarHistory = (id: string) => {
  return http.post<unknown, { avatarUrl: string }>(`/user/avatar/history/${id}/use`);
};

export const getMyDownloads = (params: { page?: number; pageSize?: number } = {}) => {
  const { page = 1, pageSize = 20 } = params;
  return http.get<unknown, { list: DownloadHistoryItem[]; total: number }>(
    `/user/downloads?page=${page}&pageSize=${pageSize}`,
  );
};

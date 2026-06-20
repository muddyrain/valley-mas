import { ApiError, type ApiResponse, apiRequest, getApiBaseUrl } from './client';

export interface DesktopUser {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  role: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  downloadCount?: number;
  creatorCode?: string;
}

interface LoginResponse {
  token: string;
  userInfo: DesktopUser;
}

export interface DesktopUserProfileInput {
  nickname?: string;
  avatar?: string;
  email?: string;
  phone?: string;
}

export interface UploadAvatarResponse {
  avatarUrl: string;
}

export function loginWithPassword(email: string, password: string) {
  return apiRequest<LoginResponse>('/login', {
    method: 'POST',
    body: {
      email,
      password,
      loginType: 'password',
    },
  });
}

export function getCurrentUser(token: string) {
  return apiRequest<DesktopUser>('/user/current', { token });
}

export function getUserInfo(token: string) {
  return apiRequest<DesktopUser>('/user/info', { token });
}

export function updateUserProfile(profile: DesktopUserProfileInput, token: string) {
  return apiRequest<DesktopUser>('/user/profile', {
    method: 'PUT',
    body: profile,
    token,
  });
}

export async function uploadAvatar(file: File, token: string) {
  const formData = new FormData();
  formData.append('file', file);

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/user/avatar`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
    });
  } catch {
    throw new ApiError('无法连接到服务器');
  }

  let payload: Partial<ApiResponse<UploadAvatarResponse>> | null = null;
  try {
    payload = (await response.json()) as Partial<ApiResponse<UploadAvatarResponse>>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(payload?.message || '上传失败', response.status);
  }

  if (payload?.code !== 0) {
    throw new ApiError(payload?.message || '上传失败', payload?.code);
  }

  return payload.data as UploadAvatarResponse;
}

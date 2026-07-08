import http from '@/utils/request';

export interface FollowItem {
  id: string;
  userId: string;
  followedUserId: string;
  createdAt: string;
  followedUser?: {
    id: string;
    nickname: string;
    avatar: string;
    description?: string;
  };
}

export const followUser = (userId: string) =>
  http.post<unknown, { ok: boolean }>(`/user/users/${userId}/follow`);

export const unfollowUser = (userId: string) =>
  http.delete<unknown, { ok: boolean }>(`/user/users/${userId}/follow`);

export const getUserFollowStatus = (userId: string) =>
  http.get<unknown, { isFollowing: boolean }>(`/user/users/${userId}/follow/status`);

export const getMyFollows = (params: { page: number; pageSize: number }) => {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  return http.get<unknown, { list: FollowItem[]; total: number }>(
    `/user/follows?${query.toString()}`,
  );
};

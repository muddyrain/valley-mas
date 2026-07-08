import http from '@/utils/request';

export interface UserAlbum {
  id: string;
  userId: string;
  name: string;
  description: string;
  coverUrl: string;
  coverResourceId?: string;
  resourceCount: number;
  resources?: Array<{
    id: string;
    title: string;
    url: string;
    thumbnailUrl: string;
    type: string;
    visibility?: string;
  }>;
}

export const getMyUserAlbums = () =>
  http.get<unknown, { list: UserAlbum[]; total: number }>('/user/albums');

export const createUserAlbum = (data: {
  name: string;
  description: string;
  coverResourceId?: string;
  resourceIds?: string[];
}) => http.post<unknown, UserAlbum>('/user/albums', data);

export const updateUserAlbum = (
  id: string,
  data: {
    name: string;
    description: string;
    coverResourceId?: string;
    resourceIds?: string[];
  },
) => http.put<unknown, UserAlbum>(`/user/albums/${id}`, data);

export const deleteUserAlbum = (id: string) =>
  http.delete<unknown, { ok: boolean }>(`/user/albums/${id}`);

import { request } from '@/lib/request';

export const waterPlant = (id: number) =>
  request.post<{ reply: string }>(`/garden/plant/${id}/water`).then((r) => r.data);

export const chatPlant = (id: number, message: string) =>
  request.post<{ reply: string }>(`/garden/plant/${id}/chat`, { message }).then((r) => r.data);

import { request } from '@/lib/request';
import type { Harvest, Plant } from './types';

export interface ShareView {
  plant: Plant;
  harvest: Harvest;
}

export const fetchShare = (id: number) =>
  request.get<ShareView>(`/garden/share/${id}`).then((r) => r.data);

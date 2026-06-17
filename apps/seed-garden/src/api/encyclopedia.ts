import { request } from '@/lib/request';
import type { Harvest, Plant } from './types';

export interface EncyclopediaItem {
  plant: Plant;
  harvest: Harvest;
}

export const fetchEncyclopedia = () =>
  request.get<EncyclopediaItem[]>('/garden/encyclopedia').then((r) => r.data);

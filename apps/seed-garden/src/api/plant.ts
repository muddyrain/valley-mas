import { request } from '@/lib/request';
import type { Plant, WaterStyle } from './types';

export const plantSeed = (concept: string, waterStyle: WaterStyle) =>
  request.post<Plant>('/garden/plant', { concept, water_style: waterStyle }).then((r) => r.data);

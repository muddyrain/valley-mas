import { request } from '@/lib/request';
import type { Plant, PlantDetailView, WaterStyle } from './types';

export const plantSeed = (concept: string, waterStyle: WaterStyle) =>
  request.post<Plant>('/garden/plant', { concept, water_style: waterStyle }).then((r) => r.data);

export const fetchPlantDetail = (id: number) =>
  request.get<PlantDetailView>(`/garden/plant/${id}`).then((r) => r.data);

import { request } from '@/lib/request';
import type { GardenView } from './types';

export const fetchGarden = () => request.get<GardenView>('/garden').then((r) => r.data);

import { create } from 'zustand';
import type { Garden, Plant } from '@/api/types';

interface GardenState {
  garden: Garden | null;
  plants: Plant[];
  setGarden: (g: Garden | null) => void;
  setPlants: (p: Plant[]) => void;
  upsertPlant: (p: Plant) => void;
}

export const useGardenStore = create<GardenState>((set) => ({
  garden: null,
  plants: [],
  setGarden: (garden) => set({ garden }),
  setPlants: (plants) => set({ plants }),
  upsertPlant: (p) =>
    set((s) => {
      const existing = s.plants.findIndex((x) => x.id === p.id);
      if (existing >= 0) {
        const arr = [...s.plants];
        arr[existing] = p;
        return { plants: arr };
      }
      return { plants: [...s.plants, p] };
    }),
}));

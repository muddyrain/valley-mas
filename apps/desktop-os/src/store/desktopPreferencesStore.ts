import { create } from 'zustand';

export type WallpaperKind = 'scene' | 'image';

export interface WallpaperOption {
  id: string;
  label: string;
  kind: WallpaperKind;
  source?: string;
}

export const WALLPAPER_OPTIONS: WallpaperOption[] = [
  {
    id: 'plush-scene',
    label: '默认草坡',
    kind: 'scene',
  },
  {
    id: 'plush-day',
    label: 'Plush Day',
    kind: 'image',
    source: '/wallpaper/plush-day.png',
  },
];

interface DesktopPreferencesStore {
  wallpaperId: string;
  setWallpaper: (id: string) => void;
}

export const useDesktopPreferencesStore = create<DesktopPreferencesStore>((set) => ({
  wallpaperId: WALLPAPER_OPTIONS[0].id,
  setWallpaper: (id) => {
    if (!WALLPAPER_OPTIONS.some((option) => option.id === id)) return;
    set({ wallpaperId: id });
  },
}));

export function getWallpaperOption(id: string) {
  return WALLPAPER_OPTIONS.find((option) => option.id === id) ?? WALLPAPER_OPTIONS[0];
}

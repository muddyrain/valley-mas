export type Rarity = 'N' | 'R' | 'SR' | 'SSR';
export type WaterStyle = 'water' | 'coffee' | 'wine' | 'potion';
export type PlantStatus = 'growing' | 'mature' | 'harvested';

export interface Garden {
  id: number;
  user_id: number;
  slot_count: number;
  experience: number;
  created_at: string;
  updated_at: string;
}

export interface Plant {
  id: number;
  user_id: number;
  slot_index: number;
  concept_input: string;
  concept_en: string;
  name: string;
  description: string;
  water_style: WaterStyle;
  rarity: Rarity;
  stage: number;
  stage_max: number;
  asset_key: string;
  next_stage_at: string;
  mood: string;
  status: PlantStatus;
  created_at: string;
  updated_at: string;
  harvested_at: string | null;
}

export interface GardenView {
  garden: Garden;
  plants: Plant[];
}

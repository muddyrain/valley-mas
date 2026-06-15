import { apiRequest } from '@/api/request';
import type {
  ClosetCategory,
  ClosetItem,
  ClosetItemStatus,
  ClosetSeason,
  ClosetWarmthLevel,
  HouseholdSummary,
  ListPagination,
  NewClosetItemInput,
  NewOutfitInput,
  Outfit,
  OutfitStatus,
} from '@/types';

export type ListClosetItemsOptions = {
  page?: number;
  pageSize?: number;
  householdId?: string;
  status?: ClosetItemStatus | 'all';
  category?: ClosetCategory | 'all';
  shared?: boolean;
  q?: string;
};

export type ClosetSummary = {
  total: number;
  active: number;
  shared: number;
  categories: Partial<Record<ClosetCategory, number>>;
};

export type ListClosetItemsResponse = {
  householdId?: string;
  householdName?: string;
  list: ClosetListItem[];
  pagination?: ListPagination;
  summary?: ClosetSummary;
};

export type ClosetItemWearStats = {
  wornCount: number;
  lastWornDate?: string;
  idleDays?: number;
  idleLevel?: 'normal' | 'idle' | 'stale';
};

export type ClosetItemCareStats = {
  wornCountSinceCare: number;
  careStatus: 'unset' | 'fresh' | 'due' | 'overdue';
  dueInWears?: number;
  overdueWears?: number;
};

export type ClosetListItem = ClosetItem & {
  wearStats?: ClosetItemWearStats;
  careStats?: ClosetItemCareStats;
};

export type ClosetItemDetailResponse = {
  item: ClosetItem;
  household: HouseholdSummary;
  wearStats?: ClosetItemWearStats;
  careStats?: ClosetItemCareStats;
};

export type ClosetItemCareInput = {
  lastCareDate: string;
};

export type ListOutfitsOptions = {
  page?: number;
  pageSize?: number;
  householdId?: string;
  status?: OutfitStatus | 'all';
  scene?: string;
};

export type ListOutfitsResponse = {
  householdId?: string;
  householdName?: string;
  list: Outfit[];
  pagination?: ListPagination;
};

export type OutfitDetailResponse = {
  outfit: Outfit;
  items: ClosetItem[];
  household: HouseholdSummary;
};

export type OutfitStatusInput = {
  status: OutfitStatus;
  wornDate?: string;
  rating?: number;
  note?: string;
};

export type ClothingPhotoAnalysisRequest = {
  imageUrl: string;
  householdId?: string;
  hint?: string;
};

export type ClothingPhotoAnalysisResponse = {
  name: string;
  category: ClosetCategory;
  color: string;
  material?: string;
  warmthLevel: ClosetWarmthLevel;
  seasons: ClosetSeason[];
  sceneTags: string[];
  summary: string;
  confidence: number;
  warnings: string[];
  householdId?: string;
  householdName?: string;
  source: 'ark';
  model?: string;
};

export type OutfitSuggestionsRequest = {
  householdId?: string;
  weatherText?: string;
  temperature?: number;
  lowTemp?: number;
  highTemp?: number;
  precip?: string;
  planType?: string;
  scene?: string;
  planTitle?: string;
  excludeIds?: string[];
  preferShared?: boolean;
};

export type OutfitSuggestion = {
  title: string;
  summary: string;
  itemIds: string[];
  items: ClosetItem[];
  scene: string;
  weatherText?: string;
  score: number;
  source: 'rule' | 'ai';
  model?: string;
};

export type OutfitSuggestionsResponse = {
  householdId?: string;
  householdName?: string;
  suggestions: OutfitSuggestion[];
  source: 'rule-ai';
  model?: string;
};

function buildListQuery(options: Record<string, unknown> = {}) {
  const params = new URLSearchParams();
  Object.entries(options).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') {
      return;
    }
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function listClosetItems(token: string, options: ListClosetItemsOptions = {}) {
  return apiRequest<ListClosetItemsResponse>(
    `/life-trace/closet/items${buildListQuery(options)}`,
    token,
  );
}

export function getClosetItem(token: string, id: string) {
  return apiRequest<ClosetItemDetailResponse>(`/life-trace/closet/items/${id}`, token);
}

export function createClosetItem(token: string, input: NewClosetItemInput, householdId?: string) {
  return apiRequest<ClosetItem>(
    `/life-trace/closet/items${buildListQuery({ householdId })}`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateClosetItem(
  token: string,
  id: string,
  input: NewClosetItemInput,
  householdId?: string,
) {
  return apiRequest<ClosetItem>(
    `/life-trace/closet/items/${id}${buildListQuery({ householdId })}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function deleteClosetItem(token: string, id: string) {
  return apiRequest<{ id: string }>(`/life-trace/closet/items/${id}`, token, {
    method: 'DELETE',
  });
}

export function updateClosetItemCare(token: string, id: string, input: ClosetItemCareInput) {
  return apiRequest<ClosetItem>(`/life-trace/closet/items/${id}/care`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listOutfits(token: string, options: ListOutfitsOptions = {}) {
  return apiRequest<ListOutfitsResponse>(
    `/life-trace/closet/outfits${buildListQuery(options)}`,
    token,
  );
}

export function getOutfit(token: string, id: string) {
  return apiRequest<OutfitDetailResponse>(`/life-trace/closet/outfits/${id}`, token);
}

export function createOutfit(token: string, input: NewOutfitInput, householdId?: string) {
  return apiRequest<Outfit>(`/life-trace/closet/outfits${buildListQuery({ householdId })}`, token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateOutfitStatus(token: string, id: string, input: OutfitStatusInput) {
  return apiRequest<Outfit>(`/life-trace/closet/outfits/${id}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function analyzeClothingPhoto(token: string, input: ClothingPhotoAnalysisRequest) {
  return apiRequest<ClothingPhotoAnalysisResponse>(
    '/life-trace/ai/clothing-photo-analysis',
    token,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function generateOutfitSuggestions(token: string, input: OutfitSuggestionsRequest) {
  return apiRequest<OutfitSuggestionsResponse>('/life-trace/ai/outfit-suggestions', token, {
    method: 'POST',
    body: JSON.stringify(input),
    suppressErrorToast: true,
  });
}

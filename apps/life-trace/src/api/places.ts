import { apiRequest } from '@/api/request';
import type { ListPagination, Place, PlaceRecord, PlaceStatus } from '@/types';

export type ListPlacesOptions = {
  page?: number;
  pageSize?: number;
  q?: string;
  favorite?: boolean;
  archived?: boolean;
  status?: PlaceStatus;
};

export type CreatePlaceInput = {
  name: string;
  status?: PlaceStatus;
  favorite?: boolean;
  city?: string;
  district?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  clearCoordinates?: boolean;
  note?: string;
};

export type UpdatePlaceInput = {
  name?: string;
  status?: PlaceStatus;
  favorite?: boolean;
  archived?: boolean;
  city?: string;
  district?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  note?: string;
};

export type PlaceExport = {
  exportedAt: string;
  places: Place[];
  records: Array<{
    placeId: string;
    record: PlaceRecord;
  }>;
};

function buildListQuery(options: ListPlacesOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) {
    params.set('page', String(options.page));
  }
  if (options.pageSize) {
    params.set('pageSize', String(options.pageSize));
  }
  if (options.q?.trim()) {
    params.set('q', options.q.trim());
  }
  if (typeof options.favorite === 'boolean') {
    params.set('favorite', String(options.favorite));
  }
  if (typeof options.archived === 'boolean') {
    params.set('archived', String(options.archived));
  }
  if (options.status) {
    params.set('status', options.status);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function listPlaces(token: string, options: ListPlacesOptions = {}) {
  return apiRequest<{ list: Place[]; pagination?: ListPagination }>(
    `/life-trace/places${buildListQuery(options)}`,
    token,
  );
}

export function createPlace(token: string, input: CreatePlaceInput) {
  return apiRequest<Place>('/life-trace/places', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function exportPlaces(token: string) {
  return apiRequest<PlaceExport>('/life-trace/places/export', token);
}

export function getPlace(token: string, id: string) {
  return apiRequest<Place>(`/life-trace/places/${id}`, token);
}

export function updatePlace(token: string, id: string, input: UpdatePlaceInput) {
  return apiRequest<Place>(`/life-trace/places/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listPlaceRecords(token: string, id: string, options: ListPlacesOptions = {}) {
  return apiRequest<{ list: PlaceRecord[]; pagination?: ListPagination }>(
    `/life-trace/places/${id}/records${buildListQuery(options)}`,
    token,
  );
}

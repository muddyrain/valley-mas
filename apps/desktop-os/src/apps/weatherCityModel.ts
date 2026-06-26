import { DEFAULT_WEATHER_CITY } from '../api/weather';

export interface WeatherCityItem {
  id: string;
  label: string;
  query: string;
  currentLocation: boolean;
}

export const WEATHER_CITIES_STORAGE_KEY = 'desktop-os-weather-cities';
export const WEATHER_CITIES_PREFERENCE_NAMESPACE = 'desktop-os.weather.cities';

const WEATHER_CITIES_PREFERENCE_VERSION = 2;

interface WeatherCityPreferenceItem {
  query: string;
}

export interface WeatherCitiesPreferenceValue {
  version: number;
  cities: WeatherCityPreferenceItem[];
  updatedAt?: string;
}

export function isCoordinateWeatherQuery(value: string) {
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(value.trim());
}

export function formatWeatherLocationLabel(query: string, apiCity?: string) {
  const city = apiCity?.trim();
  if (city) return city;
  const trimmed = query.trim();
  if (!trimmed) return DEFAULT_WEATHER_CITY;
  return isCoordinateWeatherQuery(trimmed) ? '当前位置' : trimmed;
}

export function createDefaultWeatherCities(query: string, apiCity?: string): WeatherCityItem[] {
  const currentQuery = query.trim() || DEFAULT_WEATHER_CITY;
  const currentLabel = formatWeatherLocationLabel(currentQuery, apiCity);
  return [
    {
      id: 'current',
      label: currentLabel,
      query: currentQuery,
      currentLocation: true,
    },
  ];
}

export function createWeatherCityItem(input: string): WeatherCityItem {
  const query = input.trim() || DEFAULT_WEATHER_CITY;
  return {
    id: `city-${query.toLowerCase()}`,
    label: formatWeatherLocationLabel(query),
    query,
    currentLocation: false,
  };
}

export function readWeatherCities(storage: Storage | undefined, query: string, apiCity?: string) {
  const preference = readWeatherCitiesPreference(storage);
  return applyWeatherCitiesPreference(preference, query, apiCity);
}

export function writeWeatherCities(storage: Storage | undefined, cities: WeatherCityItem[]) {
  writeWeatherCitiesPreference(storage, createWeatherCitiesPreference(cities));
}

export function readWeatherCitiesPreference(
  storage: Storage | undefined,
): WeatherCitiesPreferenceValue | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WEATHER_CITIES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return createLegacyWeatherCitiesPreference(parsed);
    return normalizeWeatherCitiesPreference(parsed);
  } catch {
    return null;
  }
}

export function writeWeatherCitiesPreference(
  storage: Storage | undefined,
  preference: WeatherCitiesPreferenceValue,
) {
  if (!storage) return;
  try {
    storage.setItem(WEATHER_CITIES_STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

export function createWeatherCitiesPreference(
  cities: WeatherCityItem[],
  updatedAt = new Date().toISOString(),
): WeatherCitiesPreferenceValue {
  return {
    version: WEATHER_CITIES_PREFERENCE_VERSION,
    updatedAt,
    cities: normalizePreferenceCities(
      cities.filter((city) => !city.currentLocation).map((city) => ({ query: city.query.trim() })),
    ),
  };
}

export function snapshotWeatherCitiesPreference(
  cities: WeatherCityItem[],
): WeatherCitiesPreferenceValue {
  return createWeatherCitiesPreference(cities);
}

export function parseWeatherCitiesPreference(raw: string): WeatherCitiesPreferenceValue | null {
  try {
    return normalizeWeatherCitiesPreference(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function applyWeatherCitiesPreference(
  value: WeatherCitiesPreferenceValue | null,
  query: string,
  apiCity?: string,
  baseCities: WeatherCityItem[] = [],
) {
  if (!value) return createDefaultWeatherCities(query, apiCity);
  const existingCurrent = baseCities.find((city) => city.currentLocation);
  return ensureWeatherCities(
    [
      existingCurrent ?? {
        id: 'current',
        label: formatWeatherLocationLabel(query, apiCity),
        query,
        currentLocation: true,
      },
      ...value.cities.map((city) => createWeatherCityItem(city.query)),
    ],
    query,
    apiCity,
  );
}

export function chooseWeatherCitiesPreference(
  first: WeatherCitiesPreferenceValue | null,
  second: WeatherCitiesPreferenceValue | null,
) {
  if (!first) return second;
  if (!second) return first;
  const firstIsVersion2 = isVersion2WeatherCitiesPreference(first);
  const secondIsVersion2 = isVersion2WeatherCitiesPreference(second);
  if (firstIsVersion2 && secondIsVersion2) {
    return getPreferenceTime(first) >= getPreferenceTime(second) ? first : second;
  }
  if (firstIsVersion2) return first;
  if (secondIsVersion2) return second;
  return null;
}

export function mergeLegacyWeatherCitiesPreferences(
  first: WeatherCitiesPreferenceValue | null,
  second: WeatherCitiesPreferenceValue | null,
  updatedAt = new Date().toISOString(),
): WeatherCitiesPreferenceValue {
  return {
    version: WEATHER_CITIES_PREFERENCE_VERSION,
    updatedAt,
    cities: normalizePreferenceCities([...(first?.cities ?? []), ...(second?.cities ?? [])]),
  };
}

export function resolveWeatherCitiesPreference(
  local: WeatherCitiesPreferenceValue | null,
  remote: WeatherCitiesPreferenceValue | null,
  updatedAt = new Date().toISOString(),
) {
  const chosen = chooseWeatherCitiesPreference(local, remote);
  if (chosen) {
    return {
      preference: chosen,
      shouldSaveLocal: remote === chosen && local !== chosen,
      shouldSaveRemote: local === chosen && remote !== chosen,
    };
  }

  const preference = mergeLegacyWeatherCitiesPreferences(local, remote, updatedAt);
  return {
    preference,
    shouldSaveLocal: true,
    shouldSaveRemote: true,
  };
}

export function resolveWeatherCityListLabel(city: WeatherCityItem, selectedLocationLabel?: string) {
  if (city.currentLocation) return city.label || city.query;
  return city.label || selectedLocationLabel || city.query;
}

export function resolveSelectedWeatherLocationLabel(
  query: string,
  apiCity?: string,
  cities: WeatherCityItem[] = [],
) {
  const city = apiCity?.trim();
  if (city) return city;
  if (isCoordinateWeatherQuery(query)) {
    const currentLocation = cities.find((item) => item.currentLocation);
    return currentLocation?.label || formatWeatherLocationLabel(query, apiCity);
  }
  return formatWeatherLocationLabel(query, apiCity);
}

export function ensureWeatherCities(
  cities: WeatherCityItem[],
  query: string,
  apiCity?: string,
): WeatherCityItem[] {
  const existingCurrent = cities.find((city) => city.currentLocation);
  const queryIsCoordinate = isCoordinateWeatherQuery(query);
  const currentQuery = queryIsCoordinate ? query.trim() : existingCurrent?.query || query.trim();
  const currentLabel = resolveCurrentWeatherCityLabel(currentQuery, apiCity, existingCurrent);
  const current: WeatherCityItem = {
    id: 'current',
    label: currentLabel,
    query: currentQuery || DEFAULT_WEATHER_CITY,
    currentLocation: true,
  };
  const next = [current];

  for (const city of cities) {
    if (city.currentLocation) continue;
    if (!hasCity(next, city.query)) next.push(createWeatherCityItem(city.query));
  }

  return next;
}

export function addWeatherCity(cities: WeatherCityItem[], input: string) {
  const city = createWeatherCityItem(input);
  if (isCoordinateWeatherQuery(city.query) || hasCity(cities, city.query)) {
    return cities;
  }
  return [...cities, city];
}

export function removeWeatherCity(cities: WeatherCityItem[], id: string) {
  const target = cities.find((city) => city.id === id);
  if (!target || target.currentLocation) return cities;
  const next = cities.filter((city) => city.id !== id);
  return next.some((city) => city.currentLocation) ? next : cities;
}

function hasCity(cities: WeatherCityItem[], query: string) {
  const normalized = query.trim().toLowerCase();
  return cities.some((city) => city.query.trim().toLowerCase() === normalized);
}

function normalizeWeatherCitiesPreference(value: unknown): WeatherCitiesPreferenceValue | null {
  if (!value || typeof value !== 'object') return null;
  const preference = value as Partial<WeatherCitiesPreferenceValue>;
  if (!Array.isArray(preference.cities)) return null;
  const version = Number(preference.version ?? 1);
  const normalized: WeatherCitiesPreferenceValue = {
    version: Number.isFinite(version) ? version : 1,
    cities: normalizePreferenceCities(preference.cities),
  };
  if (typeof preference.updatedAt === 'string' && preference.updatedAt.trim()) {
    normalized.updatedAt = preference.updatedAt.trim();
  }
  return normalized;
}

function createLegacyWeatherCitiesPreference(value: Array<Partial<WeatherCityItem>>) {
  return {
    version: 1,
    cities: normalizePreferenceCities(
      value
        .filter((item) => !item.currentLocation && typeof item.query === 'string')
        .map((item) => ({ query: item.query ?? '' })),
    ),
  };
}

function normalizePreferenceCities(cities: WeatherCityPreferenceItem[]) {
  const seen = new Set<string>();
  const next: WeatherCityPreferenceItem[] = [];
  for (const city of cities) {
    if (!isWeatherCityPreferenceItem(city)) continue;
    const query = city.query.trim();
    const key = query.toLowerCase();
    if (!query || seen.has(key) || isCoordinateWeatherQuery(query)) continue;
    seen.add(key);
    next.push({ query });
  }
  return next;
}

function isVersion2WeatherCitiesPreference(value: WeatherCitiesPreferenceValue) {
  return value.version >= WEATHER_CITIES_PREFERENCE_VERSION && Boolean(value.updatedAt);
}

function getPreferenceTime(value: WeatherCitiesPreferenceValue) {
  const time = Date.parse(value.updatedAt ?? '');
  return Number.isNaN(time) ? 0 : time;
}

function resolveCurrentWeatherCityLabel(
  query: string,
  apiCity: string | undefined,
  existingCurrent: WeatherCityItem | undefined,
) {
  const apiLabel = apiCity?.trim();
  if (apiLabel) return apiLabel;

  const normalizedQuery = query.trim().toLowerCase();
  const existingQuery = existingCurrent?.query.trim().toLowerCase();
  if (existingQuery && existingQuery === normalizedQuery && existingCurrent?.label) {
    return existingCurrent.label;
  }

  return formatWeatherLocationLabel(query, apiCity);
}

function isWeatherCityPreferenceItem(value: unknown): value is WeatherCityPreferenceItem {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as Partial<WeatherCityPreferenceItem>).query === 'string';
}

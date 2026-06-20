import { DEFAULT_WEATHER_CITY } from '../api/weather';

export interface WeatherCityItem {
  id: string;
  label: string;
  query: string;
  currentLocation: boolean;
}

export const WEATHER_CITIES_STORAGE_KEY = 'desktop-os-weather-cities';
export const WEATHER_CITIES_PREFERENCE_NAMESPACE = 'desktop-os.weather.cities';

const DEFAULT_CITY_NAMES = [DEFAULT_WEATHER_CITY, '杭州'];
const WEATHER_CITIES_PREFERENCE_VERSION = 1;

interface WeatherCityPreferenceItem {
  query: string;
}

export interface WeatherCitiesPreferenceValue {
  version: number;
  cities: WeatherCityPreferenceItem[];
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
  const cities: WeatherCityItem[] = [
    {
      id: 'current',
      label: currentLabel,
      query: currentQuery,
      currentLocation: true,
    },
  ];

  for (const name of DEFAULT_CITY_NAMES) {
    if (!hasCity(cities, name)) {
      cities.push(createWeatherCityItem(name));
    }
  }

  return cities;
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
  if (!storage) return createDefaultWeatherCities(query, apiCity);
  try {
    const raw = storage.getItem(WEATHER_CITIES_STORAGE_KEY);
    if (!raw) return createDefaultWeatherCities(query, apiCity);
    const parsed = JSON.parse(raw) as Array<Partial<WeatherCityItem>>;
    if (!Array.isArray(parsed)) return createDefaultWeatherCities(query, apiCity);
    const cities = parsed
      .filter(
        (item): item is Pick<WeatherCityItem, 'query'> & Partial<WeatherCityItem> =>
          typeof item.query === 'string',
      )
      .map((item) =>
        item.currentLocation
          ? {
              id: 'current',
              label: formatWeatherLocationLabel(query, apiCity),
              query,
              currentLocation: true,
            }
          : createWeatherCityItem(item.query),
      );
    return ensureWeatherCities(cities, query, apiCity);
  } catch {
    return createDefaultWeatherCities(query, apiCity);
  }
}

export function writeWeatherCities(storage: Storage | undefined, cities: WeatherCityItem[]) {
  if (!storage) return;
  try {
    storage.setItem(WEATHER_CITIES_STORAGE_KEY, JSON.stringify(cities));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

export function snapshotWeatherCitiesPreference(
  cities: WeatherCityItem[],
): WeatherCitiesPreferenceValue {
  return {
    version: WEATHER_CITIES_PREFERENCE_VERSION,
    cities: cities
      .filter((city) => !city.currentLocation)
      .map((city) => ({ query: city.query.trim() }))
      .filter((city) => city.query.length > 0),
  };
}

export function parseWeatherCitiesPreference(raw: string): WeatherCitiesPreferenceValue | null {
  try {
    const value = JSON.parse(raw) as Partial<WeatherCitiesPreferenceValue>;
    if (!Array.isArray(value.cities)) return null;
    return {
      version: Number(value.version ?? WEATHER_CITIES_PREFERENCE_VERSION),
      cities: value.cities
        .filter(isWeatherCityPreferenceItem)
        .map((city) => ({ query: city.query.trim() }))
        .filter((city) => city.query.length > 0),
    };
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
  const currentLabel = queryIsCoordinate
    ? apiCity?.trim() || existingCurrent?.label || formatWeatherLocationLabel(query, apiCity)
    : existingCurrent?.label || formatWeatherLocationLabel(query, apiCity);
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

function isWeatherCityPreferenceItem(value: unknown): value is WeatherCityPreferenceItem {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as Partial<WeatherCityPreferenceItem>).query === 'string';
}

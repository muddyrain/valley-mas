import { create } from 'zustand';
import { DEFAULT_WEATHER_CITY, fetchDesktopWeather, type WeatherApiResponse } from '../api/weather';

const WEATHER_CACHE_MS = 10 * 60 * 1000;

interface WeatherCacheEntry {
  weather: WeatherApiResponse;
  lastLoadedAt: number;
}

interface WeatherStore {
  city: string;
  weather: WeatherApiResponse | null;
  weatherCache: Record<string, WeatherCacheEntry>;
  loading: boolean;
  locating: boolean;
  locationAttempted: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  loadWeather: (refresh?: boolean) => Promise<void>;
  prefetchWeather: (city: string) => Promise<void>;
  setCity: (city: string) => void;
}

let weatherRequestSeq = 0;
const weatherPrefetchRequests = new Set<string>();

export const useWeatherStore = create<WeatherStore>((set, get) => ({
  city: DEFAULT_WEATHER_CITY,
  weather: null,
  weatherCache: {},
  loading: false,
  locating: false,
  locationAttempted: false,
  error: null,
  lastLoadedAt: null,

  loadWeather: async (refresh = false) => {
    const state = get();
    if (state.loading) return;
    const requestId = ++weatherRequestSeq;

    set({ loading: true, error: null });
    try {
      let city = state.city;
      if (!state.locationAttempted) {
        set({ locating: true, locationAttempted: true });
        city = (await getBrowserWeatherLocation()) || DEFAULT_WEATHER_CITY;
        if (requestId !== weatherRequestSeq) return;
        set({ city, locating: false });
      }

      const cacheKey = getWeatherCacheKey(city);
      const cached = get().weatherCache[cacheKey];
      if (!refresh && cached && Date.now() - cached.lastLoadedAt < WEATHER_CACHE_MS) {
        set({
          weather: cached.weather,
          loading: false,
          locating: false,
          error: null,
          lastLoadedAt: cached.lastLoadedAt,
        });
        return;
      }

      const weather = await fetchDesktopWeather(city, { refresh });
      if (requestId !== weatherRequestSeq) return;
      const loadedAt = Date.now();
      set((current) => ({
        weather,
        loading: false,
        locating: false,
        error: null,
        lastLoadedAt: loadedAt,
        weatherCache: {
          ...current.weatherCache,
          [cacheKey]: {
            weather,
            lastLoadedAt: loadedAt,
          },
        },
      }));
    } catch (error) {
      if (requestId !== weatherRequestSeq) return;
      set({
        loading: false,
        locating: false,
        error: error instanceof Error ? error.message : '天气加载失败',
      });
    }
  },

  setCity: (city) => {
    const nextCity = city.trim() || DEFAULT_WEATHER_CITY;
    const current = get();
    if (getWeatherCacheKey(current.city) === getWeatherCacheKey(nextCity)) {
      set({ error: null, locationAttempted: true });
      return;
    }
    weatherRequestSeq += 1;
    const cached = current.weatherCache[getWeatherCacheKey(nextCity)];
    set({
      city: nextCity,
      weather: cached ? cached.weather : null,
      error: null,
      loading: false,
      locating: false,
      lastLoadedAt: cached ? cached.lastLoadedAt : null,
      locationAttempted: true,
    });
  },

  prefetchWeather: async (city) => {
    const query = city.trim();
    if (!query) return;
    const cacheKey = getWeatherCacheKey(query);
    const cached = get().weatherCache[cacheKey];
    if (cached && Date.now() - cached.lastLoadedAt < WEATHER_CACHE_MS) return;
    if (weatherPrefetchRequests.has(cacheKey)) return;

    weatherPrefetchRequests.add(cacheKey);
    try {
      const weather = await fetchDesktopWeather(query);
      const loadedAt = Date.now();
      set((current) => {
        const nextCache = {
          ...current.weatherCache,
          [cacheKey]: {
            weather,
            lastLoadedAt: loadedAt,
          },
        };
        const isActiveCity = getWeatherCacheKey(current.city) === cacheKey;
        return {
          weatherCache: nextCache,
          ...(isActiveCity && !current.weather
            ? {
                weather,
                lastLoadedAt: loadedAt,
              }
            : null),
        };
      });
    } catch {
      // Sidebar previews are opportunistic; the selected city still shows the main error state.
    } finally {
      weatherPrefetchRequests.delete(cacheKey);
    }
  },
}));

export function getWeatherCacheKey(city: string) {
  return (city.trim() || DEFAULT_WEATHER_CITY).toLowerCase();
}

function getBrowserWeatherLocation() {
  if (!('geolocation' in navigator)) return Promise.resolve<string | null>(null);

  return new Promise<string | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const longitude = position.coords.longitude.toFixed(4);
        const latitude = position.coords.latitude.toFixed(4);
        resolve(`${longitude},${latitude}`);
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        maximumAge: 30 * 60 * 1000,
        timeout: 5000,
      },
    );
  });
}

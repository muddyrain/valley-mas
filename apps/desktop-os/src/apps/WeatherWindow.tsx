import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { getUserPreference, updateUserPreference } from '../api/preferences';
import type { WeatherApiDay, WeatherApiHour, WeatherApiIndex } from '../api/weather';
import { useAuthStore } from '../store/authStore';
import { getWeatherCacheKey, useWeatherStore } from '../store/weatherStore';
import {
  addWeatherCity,
  applyWeatherCitiesPreference,
  ensureWeatherCities,
  parseWeatherCitiesPreference,
  readWeatherCities,
  removeWeatherCity,
  resolveSelectedWeatherLocationLabel,
  resolveWeatherCityListLabel,
  snapshotWeatherCitiesPreference,
  WEATHER_CITIES_PREFERENCE_NAMESPACE,
  type WeatherCityItem,
  writeWeatherCities,
} from './weatherCityModel';
import './WeatherWindow.css';

export default function WeatherWindow() {
  const city = useWeatherStore((s) => s.city);
  const weather = useWeatherStore((s) => s.weather);
  const loading = useWeatherStore((s) => s.loading);
  const locating = useWeatherStore((s) => s.locating);
  const error = useWeatherStore((s) => s.error);
  const weatherCache = useWeatherStore((s) => s.weatherCache);
  const loadWeather = useWeatherStore((s) => s.loadWeather);
  const prefetchWeather = useWeatherStore((s) => s.prefetchWeather);
  const setCity = useWeatherStore((s) => s.setCity);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [citySearch, setCitySearch] = useState('');
  const [cities, setCities] = useState<WeatherCityItem[]>(() =>
    readWeatherCities(getLocalStorage(), city),
  );
  const citiesRef = useRef(cities);
  const weatherContextRef = useRef({ city, apiCity: weather?.city });
  const localMutationVersionRef = useRef(0);
  const selectedCityQuery = city.trim().toLowerCase();

  useEffect(() => {
    void loadWeather();
  }, [loadWeather]);

  useEffect(() => {
    for (const item of cities) {
      if (item.query.trim().toLowerCase() === selectedCityQuery) continue;
      void prefetchWeather(item.query);
    }
  }, [cities, prefetchWeather, selectedCityQuery]);

  useEffect(() => {
    citiesRef.current = cities;
  }, [cities]);

  useEffect(() => {
    weatherContextRef.current = { city, apiCity: weather?.city };
  }, [city, weather?.city]);

  const saveWeatherCitiesToServer = useCallback(
    async (next: WeatherCityItem[], nextToken: string) => {
      try {
        await updateUserPreference(
          WEATHER_CITIES_PREFERENCE_NAMESPACE,
          JSON.stringify(snapshotWeatherCitiesPreference(next)),
          nextToken,
        );
      } catch (error) {
        console.warn('Weather cities sync failed', error);
      }
    },
    [],
  );

  const persistCities = useCallback(
    (next: WeatherCityItem[]) => {
      localMutationVersionRef.current += 1;
      citiesRef.current = next;
      setCities(next);
      writeWeatherCities(getLocalStorage(), next);
      if (isAuthenticated && token) {
        void saveWeatherCitiesToServer(next, token);
      }
    },
    [isAuthenticated, saveWeatherCitiesToServer, token],
  );

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const authToken = token;
    let cancelled = false;
    const loadVersion = localMutationVersionRef.current;

    async function loadWeatherCitiesPreference() {
      try {
        const preference = await getUserPreference(WEATHER_CITIES_PREFERENCE_NAMESPACE, authToken);
        if (cancelled || loadVersion !== localMutationVersionRef.current) return;
        const value = parseWeatherCitiesPreference(preference.value);
        const currentContext = weatherContextRef.current;
        const next = applyWeatherCitiesPreference(
          value,
          currentContext.city,
          currentContext.apiCity,
          citiesRef.current,
        );
        citiesRef.current = next;
        setCities(next);
        writeWeatherCities(getLocalStorage(), next);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          await saveWeatherCitiesToServer(citiesRef.current, authToken);
          return;
        }
        console.warn('Weather cities preference load failed', error);
      }
    }

    void loadWeatherCitiesPreference();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, saveWeatherCitiesToServer, token]);

  useEffect(() => {
    setCities((current) => {
      const next = ensureWeatherCities(current, city, weather?.city);
      citiesRef.current = next;
      writeWeatherCities(getLocalStorage(), next);
      return next;
    });
  }, [city, weather?.city]);

  const headline = useMemo(() => {
    if (locating) return '定位中';
    if (loading && !weather) return '更新中';
    return weather?.now.text ?? '天气暂不可用';
  }, [loading, locating, weather]);

  function submitCity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = citySearch.trim();
    if (!query) return;
    const next = addWeatherCity(cities, citySearch);
    const target = next.find((item) => item.query.trim().toLowerCase() === query.toLowerCase());
    persistCities(next);
    if (target && !target.currentLocation) {
      setCity(target.query);
      setCitySearch('');
      void loadWeather();
    }
  }

  function selectCity(item: WeatherCityItem) {
    if (item.query.trim().toLowerCase() === selectedCityQuery) return;
    setCity(item.query);
    void loadWeather();
  }

  function deleteCity(item: WeatherCityItem) {
    if (item.currentLocation) return;
    const next = removeWeatherCity(cities, item.id);
    persistCities(next);
    if (item.query.trim().toLowerCase() === selectedCityQuery) {
      const fallback = next.find((cityItem) => cityItem.currentLocation) ?? next[0];
      if (fallback) {
        setCity(fallback.query);
        void loadWeather();
      }
    }
  }

  const displayCity = resolveSelectedWeatherLocationLabel(city, weather?.city, cities);

  return (
    <div className="weather-window">
      <aside className="weather-sidebar">
        <form className="weather-search" onSubmit={submitCity}>
          <input
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            aria-label="搜索城市或地区"
            placeholder="搜索城市或地区"
          />
          <button type="submit" aria-label="添加城市">
            +
          </button>
        </form>

        <div className="weather-city-list">
          {cities.map((item) => {
            const isActive =
              item.query.trim().toLowerCase() === selectedCityQuery ||
              (item.currentLocation && item.query.trim().toLowerCase() === selectedCityQuery);
            const label = resolveWeatherCityListLabel(item, displayCity);
            const cachedWeather = weatherCache[getWeatherCacheKey(item.query)]?.weather;
            const rowWeather = isActive ? (weather ?? cachedWeather) : cachedWeather;
            const rowSummary = rowWeather?.now.text || getWeatherCityFallbackSubtitle(item);
            return (
              <div key={item.id} className={`weather-city ${isActive ? 'is-active' : ''}`}>
                <button
                  type="button"
                  className="weather-city__select"
                  onClick={() => selectCity(item)}
                >
                  <span>
                    <strong>{label}</strong>
                    <em>{rowSummary}</em>
                  </span>
                  <b>{formatTemperature(rowWeather?.now.temp)}</b>
                </button>
                {!item.currentLocation ? (
                  <button
                    type="button"
                    className="weather-city__delete"
                    onClick={() => deleteCity(item)}
                    aria-label={`删除${label}`}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>

      <main className="weather-detail">
        <section className="weather-window__hero">
          <div className="weather-window__hero-main">
            <div className="weather-window__eyebrow">{displayCity}</div>
            <div className="weather-window__temperature">
              {formatTemperature(weather?.now.temp)}
            </div>
            <h2>{headline}</h2>
            <p>
              {weather
                ? `${formatTemperature(weather.now.high)} / ${formatTemperature(weather.now.low)}`
                : error || '等待天气更新'}
            </p>
          </div>
          <div className="weather-window__hero-side">
            <img src="/icons/weather.png" alt="" />
            <span className="weather-window__source">
              {weather?.source === 'qweather' ? 'QWeather' : '参考天气'}
            </span>
            <div className="weather-window__status">
              <span>
                {weather?.updatedAt ? `更新于 ${formatUpdatedAt(weather.updatedAt)}` : '尚未更新'}
              </span>
              {weather?.cached ? <span>缓存</span> : null}
              {weather?.refreshLimited ? <span>刷新限速</span> : null}
            </div>
          </div>
        </section>

        <div className="weather-actions">
          <button
            type="button"
            onClick={() => void loadWeather(true)}
            disabled={loading || locating}
            aria-label="刷新天气"
          >
            {loading || locating ? '更新中' : '刷新'}
          </button>
        </div>

        {weather?.warning || error ? (
          <div className="weather-window__notice">{weather?.warning || error}</div>
        ) : null}

        <section className="weather-window__metrics" aria-label="天气指标">
          {weather ? (
            weather.metrics.map((metric) => (
              <article
                key={metric.label}
                className={`weather-metric weather-metric--${metric.tone}`}
              >
                <span>{metric.label}</span>
                <strong>{metric.value || '--'}</strong>
              </article>
            ))
          ) : (
            <WeatherEmptyState />
          )}
        </section>

        <section className="weather-window__section">
          <div className="weather-window__section-title">小时天气</div>
          <div className="weather-hourly">
            {(weather?.hourly ?? []).slice(0, 12).map((hour) => (
              <WeatherHourCard key={`${hour.time}-${hour.temp}`} hour={hour} />
            ))}
            {!weather?.hourly.length ? <WeatherEmptyState /> : null}
          </div>
        </section>

        <div className="weather-window__lower">
          <section className="weather-window__section">
            <div className="weather-window__section-title">未来几天</div>
            <div className="weather-daily">
              {(weather?.daily ?? []).slice(0, 7).map((day) => (
                <WeatherDayRow key={day.date} day={day} />
              ))}
              {!weather?.daily.length ? <WeatherEmptyState /> : null}
            </div>
          </section>

          <section className="weather-window__section">
            <div className="weather-window__section-title">生活指数</div>
            <div className="weather-indices">
              {(weather?.indices ?? []).slice(0, 4).map((item) => (
                <WeatherIndexCard key={`${item.name}-${item.category}`} item={item} />
              ))}
              {!weather?.indices.length ? <WeatherEmptyState /> : null}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function WeatherHourCard({ hour }: { hour: WeatherApiHour }) {
  return (
    <article className={`weather-hour ${hour.active ? 'is-active' : ''}`}>
      <span>{hour.time}</span>
      <strong>{formatTemperature(hour.temp)}</strong>
      <em>{hour.text}</em>
    </article>
  );
}

function WeatherDayRow({ day }: { day: WeatherApiDay }) {
  return (
    <article className="weather-day">
      <span>{formatWeatherDate(day.date)}</span>
      <strong>{day.textDay}</strong>
      <em>
        {formatTemperature(day.high)} / {formatTemperature(day.low)}
      </em>
    </article>
  );
}

function WeatherIndexCard({ item }: { item: WeatherApiIndex }) {
  return (
    <article className="weather-index">
      <span>{item.name}</span>
      <strong>{item.category}</strong>
      <p>{item.text}</p>
    </article>
  );
}

function WeatherEmptyState() {
  return <div className="weather-empty">暂无天气数据</div>;
}

function getWeatherCityFallbackSubtitle(item: WeatherCityItem) {
  return item.currentLocation ? '当前位置' : '已添加';
}

function formatTemperature(value?: string) {
  if (!value) return '--°';
  return value.endsWith('°') ? value : `${value}°`;
}

function formatWeatherDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' });
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function getLocalStorage() {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

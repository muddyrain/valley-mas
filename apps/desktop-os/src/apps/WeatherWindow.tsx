import { LoaderCircle, MapPin } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { getUserPreference, updateUserPreference } from '../api/preferences';
import type { WeatherApiDay, WeatherApiHour, WeatherApiIndex } from '../api/weather';
import { useAuthStore } from '../store/authStore';
import { getWeatherCacheKey, useWeatherStore } from '../store/weatherStore';
import { PlushButton } from '../ui/PlushPrimitives';
import {
  addWeatherCity,
  applyWeatherCitiesPreference,
  createWeatherCitiesPreference,
  ensureWeatherCities,
  parseWeatherCitiesPreference,
  readWeatherCities,
  readWeatherCitiesPreference,
  removeWeatherCity,
  resolveSelectedWeatherLocationLabel,
  resolveWeatherCitiesPreference,
  resolveWeatherCityListLabel,
  WEATHER_CITIES_PREFERENCE_NAMESPACE,
  type WeatherCitiesPreferenceValue,
  type WeatherCityItem,
  writeWeatherCitiesPreference,
} from './weatherCityModel';
import { getWeatherIconSrc } from './weatherIconModel';
import './WeatherWindow.css';

type WeatherCitySyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export default function WeatherWindow() {
  const city = useWeatherStore((s) => s.city);
  const weather = useWeatherStore((s) => s.weather);
  const loading = useWeatherStore((s) => s.loading);
  const locating = useWeatherStore((s) => s.locating);
  const locationAttempted = useWeatherStore((s) => s.locationAttempted);
  const error = useWeatherStore((s) => s.error);
  const weatherCache = useWeatherStore((s) => s.weatherCache);
  const loadWeather = useWeatherStore((s) => s.loadWeather);
  const relocateWeather = useWeatherStore((s) => s.relocateWeather);
  const prefetchWeather = useWeatherStore((s) => s.prefetchWeather);
  const setCity = useWeatherStore((s) => s.setCity);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [citySearch, setCitySearch] = useState('');
  const [citySettingsOpen, setCitySettingsOpen] = useState(false);
  const [citySyncStatus, setCitySyncStatus] = useState<WeatherCitySyncStatus>('local');
  const [cities, setCities] = useState<WeatherCityItem[]>(() =>
    readWeatherCities(getLocalStorage(), city),
  );
  const citiesRef = useRef(cities);
  const weatherContextRef = useRef({ city, apiCity: weather?.city });
  const localMutationVersionRef = useRef(0);
  const selectedCityQuery = city.trim().toLowerCase();
  const initialLocationPending = !locationAttempted && !weather;
  const currentLocationResolving = !weather && (initialLocationPending || locating);
  const currentLocationUnavailable = !weather && locationAttempted && Boolean(error);
  const shouldMaskDefaultLocation = currentLocationResolving || currentLocationUnavailable;
  const currentLocationLabel = currentLocationResolving ? '定位中' : '当前位置';

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
    async (preference: WeatherCitiesPreferenceValue, nextToken: string) => {
      setCitySyncStatus('syncing');
      try {
        await updateUserPreference(
          WEATHER_CITIES_PREFERENCE_NAMESPACE,
          JSON.stringify(preference),
          nextToken,
        );
        setCitySyncStatus('synced');
      } catch (error) {
        setCitySyncStatus('error');
        console.warn('Weather cities sync failed', error);
      }
    },
    [],
  );

  const persistCities = useCallback(
    (next: WeatherCityItem[]) => {
      const preference = createWeatherCitiesPreference(next);
      localMutationVersionRef.current += 1;
      citiesRef.current = next;
      setCities(next);
      writeWeatherCitiesPreference(getLocalStorage(), preference);
      if (isAuthenticated && token) {
        void saveWeatherCitiesToServer(preference, token);
      } else {
        setCitySyncStatus('local');
      }
    },
    [isAuthenticated, saveWeatherCitiesToServer, token],
  );

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setCitySyncStatus('local');
      return;
    }
    const authToken = token;
    let cancelled = false;
    const loadVersion = localMutationVersionRef.current;

    async function loadWeatherCitiesPreference() {
      setCitySyncStatus('syncing');
      const localPreference = readWeatherCitiesPreference(getLocalStorage());
      try {
        const preference = await getUserPreference(WEATHER_CITIES_PREFERENCE_NAMESPACE, authToken);
        if (cancelled || loadVersion !== localMutationVersionRef.current) return;
        const remotePreference = parseWeatherCitiesPreference(preference.value);
        const resolvedPreference = resolveWeatherCitiesPreference(
          localPreference,
          remotePreference,
        );
        const currentContext = weatherContextRef.current;
        const next = applyWeatherCitiesPreference(
          resolvedPreference.preference,
          currentContext.city,
          currentContext.apiCity,
          citiesRef.current,
        );
        citiesRef.current = next;
        setCities(next);
        writeWeatherCitiesPreference(getLocalStorage(), resolvedPreference.preference);
        if (resolvedPreference.shouldSaveRemote) {
          await saveWeatherCitiesToServer(resolvedPreference.preference, authToken);
        } else {
          setCitySyncStatus('synced');
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          const nextPreference =
            localPreference ?? createWeatherCitiesPreference(citiesRef.current);
          writeWeatherCitiesPreference(getLocalStorage(), nextPreference);
          await saveWeatherCitiesToServer(nextPreference, authToken);
          return;
        }
        setCitySyncStatus('error');
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
      return next;
    });
  }, [city, weather?.city]);

  const headline = useMemo(() => {
    if (initialLocationPending || locating) return '定位中';
    if (loading && !weather) return '更新中';
    return weather?.now.text ?? '天气暂不可用';
  }, [initialLocationPending, loading, locating, weather]);

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

  function relocateCurrentCity(e?: React.MouseEvent<HTMLButtonElement>) {
    e?.stopPropagation();
    void relocateWeather();
  }

  const displayCity = shouldMaskDefaultLocation
    ? currentLocationLabel
    : resolveSelectedWeatherLocationLabel(city, weather?.city, cities);

  function getCityRowView(item: WeatherCityItem) {
    const isActive =
      item.query.trim().toLowerCase() === selectedCityQuery ||
      (item.currentLocation && item.query.trim().toLowerCase() === selectedCityQuery);
    const shouldHideCurrentWeather = item.currentLocation && shouldMaskDefaultLocation;
    const cachedWeather = shouldHideCurrentWeather
      ? undefined
      : weatherCache[getWeatherCacheKey(item.query)]?.weather;
    const rowWeather = shouldHideCurrentWeather
      ? undefined
      : isActive
        ? (weather ?? cachedWeather)
        : cachedWeather;
    const label =
      item.currentLocation && shouldMaskDefaultLocation
        ? currentLocationLabel
        : item.currentLocation && rowWeather?.city
          ? rowWeather.city
          : resolveWeatherCityListLabel(item, displayCity);
    const rowSummary =
      item.currentLocation && currentLocationResolving
        ? '定位中'
        : rowWeather?.now.text || getWeatherCityFallbackSubtitle(item);
    return { isActive, label, rowSummary, rowWeather };
  }

  const citySyncLabel = getWeatherCitySyncLabel(citySyncStatus, isAuthenticated);

  return (
    <div className="weather-window">
      <aside className="weather-sidebar">
        <div className="weather-city-list">
          {cities.map((item) => {
            const { isActive, label, rowSummary, rowWeather } = getCityRowView(item);
            return (
              <div
                key={item.id}
                className={`weather-city ${item.currentLocation ? 'weather-city--current' : ''} ${
                  isActive ? 'is-active' : ''
                }`}
              >
                {item.currentLocation ? (
                  <button
                    type="button"
                    className="weather-city__locate"
                    onClick={relocateCurrentCity}
                    disabled={locating}
                    aria-label={locating ? '定位中' : '重新定位'}
                    title={locating ? '定位中' : '重新定位'}
                  >
                    {locating ? (
                      <LoaderCircle className="weather-city__locate-icon is-spinning" />
                    ) : (
                      <MapPin className="weather-city__locate-icon" />
                    )}
                  </button>
                ) : null}
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
              </div>
            );
          })}
        </div>

        <div className="weather-sidebar__footer">
          <button
            type="button"
            className="weather-city-settings-button"
            onClick={() => setCitySettingsOpen(true)}
            aria-label="城市设置"
            title="城市设置"
          >
            ⚙
          </button>
        </div>

        {citySettingsOpen ? (
          <div className="weather-city-settings" role="dialog" aria-label="城市设置">
            <div className="weather-city-settings__header">
              <div>
                <strong>城市</strong>
                <span>{citySyncLabel}</span>
              </div>
              <button type="button" onClick={() => setCitySettingsOpen(false)}>
                完成
              </button>
            </div>
            <form className="weather-search weather-city-settings__search" onSubmit={submitCity}>
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
            <div className="weather-city-settings__list">
              {cities.map((item) => {
                const { label, rowSummary } = getCityRowView(item);
                return (
                  <div key={item.id} className="weather-city-settings__row">
                    <span>
                      <strong>{label}</strong>
                      <em>{rowSummary}</em>
                    </span>
                    {item.currentLocation ? (
                      <div className="weather-city-settings__actions">
                        <button
                          type="button"
                          className="weather-city-settings__locate"
                          onClick={relocateCurrentCity}
                          disabled={locating}
                          aria-label={locating ? '定位中' : '重新定位'}
                          title={locating ? '定位中' : '重新定位'}
                        >
                          {locating ? (
                            <LoaderCircle className="weather-city-settings__locate-icon is-spinning" />
                          ) : (
                            <MapPin className="weather-city-settings__locate-icon" />
                          )}
                        </button>
                        <b className="weather-city-settings__fixed">固定</b>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="weather-city-settings__delete"
                        onClick={() => deleteCity(item)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
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
            <img src={getWeatherIconSrc(weather?.now.text, weather?.updatedAt)} alt="" />
            <span className="weather-window__source">
              {weather?.source === 'qweather' ? 'QWeather' : '参考天气'}
            </span>
            <div className="weather-window__status">
              <span>
                {weather?.updatedAt ? `更新于 ${formatUpdatedAt(weather.updatedAt)}` : '尚未更新'}
              </span>
            </div>
          </div>
        </section>

        <div className="weather-actions">
          <PlushButton
            type="button"
            unstyled
            onClick={() => void loadWeather(true)}
            loading={loading || locating}
            loadingLabel="更新中"
            aria-label="刷新天气"
          >
            刷新
          </PlushButton>
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
      <img
        className="weather-hour__icon"
        src={getWeatherIconSrc(hour.text, hour.dateTime)}
        alt=""
      />
      <strong>{formatTemperature(hour.temp)}</strong>
      <em>{hour.text}</em>
    </article>
  );
}

function WeatherDayRow({ day }: { day: WeatherApiDay }) {
  return (
    <article className="weather-day">
      <span>{formatWeatherDate(day.date)}</span>
      <img
        className="weather-day__icon"
        src={getWeatherIconSrc(day.textDay, undefined, 'day')}
        alt=""
      />
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

function getWeatherCitySyncLabel(status: WeatherCitySyncStatus, isAuthenticated: boolean) {
  if (!isAuthenticated) return '本地';
  if (status === 'syncing') return '同步中';
  if (status === 'error') return '同步失败';
  return '已同步';
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

import { describe, expect, it } from 'vitest';
import {
  chooseWeatherCitiesPreference,
  createDefaultWeatherCities,
  createWeatherCitiesPreference,
  ensureWeatherCities,
  mergeLegacyWeatherCitiesPreferences,
  resolveSelectedWeatherLocationLabel,
  resolveWeatherCityListLabel,
  type WeatherCityItem,
} from '../src/apps/weatherCityModel';

describe('weather city model', () => {
  it('starts with the current location city only', () => {
    expect(createDefaultWeatherCities('114.5000,36.6000', '邯郸')).toEqual([
      {
        id: 'current',
        label: '邯郸',
        query: '114.5000,36.6000',
        currentLocation: true,
      },
    ]);
  });

  it('keeps the current location list label independent from the selected city', () => {
    const currentLocation: WeatherCityItem = {
      id: 'current',
      label: '邯郸',
      query: '邯郸',
      currentLocation: true,
    };

    expect(resolveWeatherCityListLabel(currentLocation, '邯郸市')).toBe('邯郸');
  });

  it('keeps the known current location label while coordinate weather is refreshing', () => {
    const cities = ensureWeatherCities(
      [
        {
          id: 'current',
          label: '邯郸',
          query: '114.5000,36.6000',
          currentLocation: true,
        },
      ],
      '114.5000,36.6000',
    );

    expect(cities[0].label).toBe('邯郸');
    expect(resolveSelectedWeatherLocationLabel('114.5000,36.6000', undefined, cities)).toBe('邯郸');
  });

  it('does not reuse the previous default city after coordinates arrive', () => {
    const cities = ensureWeatherCities(
      [
        {
          id: 'current',
          label: '上海',
          query: '上海',
          currentLocation: true,
        },
      ],
      '114.5000,36.6000',
    );

    expect(cities[0]).toMatchObject({
      id: 'current',
      label: '当前位置',
      query: '114.5000,36.6000',
      currentLocation: true,
    });
  });

  it('updates the current location city name from the weather response', () => {
    const cities = ensureWeatherCities(
      [
        {
          id: 'current',
          label: '当前位置',
          query: '114.5000,36.6000',
          currentLocation: true,
        },
      ],
      '114.5000,36.6000',
      '邯郸',
    );

    expect(cities[0].label).toBe('邯郸');
  });

  it('does not include current location in preference snapshots', () => {
    const preference = createWeatherCitiesPreference(
      [
        {
          id: 'current',
          label: '邯郸',
          query: '114.5000,36.6000',
          currentLocation: true,
        },
        {
          id: 'city-北京',
          label: '北京',
          query: '北京',
          currentLocation: false,
        },
      ],
      '2026-06-20T10:00:00.000Z',
    );

    expect(preference).toEqual({
      version: 2,
      updatedAt: '2026-06-20T10:00:00.000Z',
      cities: [{ query: '北京' }],
    });
  });

  it('prefers newer version 2 weather city preferences', () => {
    const older = createWeatherCitiesPreference(
      [createAddedCity('北京')],
      '2026-06-20T10:00:00.000Z',
    );
    const newer = createWeatherCitiesPreference(
      [createAddedCity('杭州')],
      '2026-06-20T10:01:00.000Z',
    );

    expect(chooseWeatherCitiesPreference(older, newer)).toBe(newer);
    expect(chooseWeatherCitiesPreference(newer, older)).toBe(newer);
  });

  it('merges legacy local and server weather city preferences without dropping cities', () => {
    const merged = mergeLegacyWeatherCitiesPreferences(
      { version: 1, cities: [{ query: '北京' }] },
      { version: 1, cities: [{ query: '杭州' }] },
      '2026-06-20T10:00:00.000Z',
    );

    expect(merged).toEqual({
      version: 2,
      updatedAt: '2026-06-20T10:00:00.000Z',
      cities: [{ query: '北京' }, { query: '杭州' }],
    });
  });

  it('keeps deleted cities removed when a version 2 preference is newer', () => {
    const deletedLocally = createWeatherCitiesPreference([], '2026-06-20T10:01:00.000Z');
    const staleServer = createWeatherCitiesPreference(
      [createAddedCity('北京')],
      '2026-06-20T10:00:00.000Z',
    );

    expect(chooseWeatherCitiesPreference(deletedLocally, staleServer)).toBe(deletedLocally);
  });
});

function createAddedCity(query: string): WeatherCityItem {
  return {
    id: `city-${query}`,
    label: query,
    query,
    currentLocation: false,
  };
}

import { describe, expect, it } from 'vitest';
import {
  ensureWeatherCities,
  resolveSelectedWeatherLocationLabel,
  resolveWeatherCityListLabel,
  type WeatherCityItem,
} from '../src/apps/weatherCityModel';

describe('weather city model', () => {
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
});

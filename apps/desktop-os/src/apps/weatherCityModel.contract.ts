import {
  addWeatherCity,
  applyWeatherCitiesPreference,
  createDefaultWeatherCities,
  ensureWeatherCities,
  formatWeatherLocationLabel,
  isCoordinateWeatherQuery,
  parseWeatherCitiesPreference,
  removeWeatherCity,
  snapshotWeatherCitiesPreference,
} from './weatherCityModel';

const cities = createDefaultWeatherCities('119.9945,30.2348', '杭州');
const citiesWithBeijing = addWeatherCity(cities, '北京');
const withoutCurrentDelete = removeWeatherCity(citiesWithBeijing, 'current');
const withoutBeijing = removeWeatherCity(citiesWithBeijing, 'city-北京');
const withoutHangzhou = removeWeatherCity(cities, 'city-杭州');
const ensuredWithoutHangzhou = ensureWeatherCities(withoutHangzhou, '上海', '上海');
const snapshot = snapshotWeatherCitiesPreference(citiesWithBeijing);
const parsedSnapshot = parseWeatherCitiesPreference(JSON.stringify(snapshot));
const appliedSnapshot = applyWeatherCitiesPreference(parsedSnapshot, '119.9945,30.2348', '杭州');
const firstCity = cities[0];

export const WEATHER_CITY_MODEL_CONTRACT = {
  hidesCoordinateQuery: formatWeatherLocationLabel('119.9945,30.2348', '杭州') === '杭州',
  detectsCoordinateQuery: isCoordinateWeatherQuery('119.9945,30.2348'),
  keepsReadableCity: formatWeatherLocationLabel('上海', undefined) === '上海',
  firstCityLabel: firstCity.label,
  firstCityQuery: firstCity.query,
  keepsCurrentLocation: withoutCurrentDelete.some((item) => item.id === 'current'),
  removesAddedCity: !withoutBeijing.some((item) => item.query === '北京'),
  keepsDeletedDefaultCityRemoved: !ensuredWithoutHangzhou.some((item) => item.query === '杭州'),
  preferenceExcludesCurrentLocation: !snapshot.cities.some(
    (item) => item.query === firstCity.query,
  ),
  preferenceRestoresAddedCities: appliedSnapshot.some((item) => item.query === '北京'),
};

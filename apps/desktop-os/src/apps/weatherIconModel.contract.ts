import { getWeatherIconSrc } from './weatherIconModel';

export const WEATHER_ICON_MODEL_CONTRACT = {
  sunnyDay:
    getWeatherIconSrc('晴', '2026-06-21T12:00:00+08:00') === '/weather/weather-sunny-day.png',
  clearNight:
    getWeatherIconSrc('晴', '2026-06-21T23:00:00+08:00') === '/weather/weather-clear-night.png',
  partlyCloudy:
    getWeatherIconSrc('多云', '2026-06-21T15:00:00+08:00') ===
    '/weather/weather-partly-cloudy-day.png',
  thunderstorm: getWeatherIconSrc('雷阵雨') === '/weather/weather-thunderstorm.png',
  heavyRain: getWeatherIconSrc('暴雨') === '/weather/weather-heavy-rain.png',
  sleet: getWeatherIconSrc('雨夹雪') === '/weather/weather-sleet.png',
  hazeDust: getWeatherIconSrc('霾') === '/weather/weather-haze-dust.png',
  unknown: getWeatherIconSrc('天气暂不可用') === '/weather/weather-unknown.png',
};

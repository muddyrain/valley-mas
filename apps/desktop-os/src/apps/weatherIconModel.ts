type WeatherIconTime = 'auto' | 'day' | 'night';

const WEATHER_ICON_BASE = '/weather';

const WEATHER_ICON_FILES = {
  clearNight: 'weather-clear-night.png',
  cloudy: 'weather-cloudy.png',
  fog: 'weather-fog.png',
  hail: 'weather-hail.png',
  hazeDust: 'weather-haze-dust.png',
  heavyRain: 'weather-heavy-rain.png',
  heavySnow: 'weather-heavy-snow.png',
  lightRain: 'weather-light-rain.png',
  lightSnow: 'weather-light-snow.png',
  moderateRain: 'weather-moderate-rain.png',
  overcast: 'weather-overcast.png',
  partlyCloudyDay: 'weather-partly-cloudy-day.png',
  partlyCloudyNight: 'weather-partly-cloudy-night.png',
  sleet: 'weather-sleet.png',
  sunnyDay: 'weather-sunny-day.png',
  thunderstorm: 'weather-thunderstorm.png',
  unknown: 'weather-unknown.png',
  windy: 'weather-windy.png',
} as const;

export function getWeatherIconSrc(
  weatherText: string | undefined,
  dateTime?: string,
  time: WeatherIconTime = 'auto',
) {
  return `${WEATHER_ICON_BASE}/${getWeatherIconFile(weatherText, dateTime, time)}`;
}

function getWeatherIconFile(
  weatherText: string | undefined,
  dateTime: string | undefined,
  time: WeatherIconTime,
) {
  const text = weatherText?.trim() ?? '';
  if (!text) return WEATHER_ICON_FILES.unknown;

  if (includesAny(text, ['冰雹'])) return WEATHER_ICON_FILES.hail;
  if (includesAny(text, ['雷阵雨', '雷暴', '强雷阵雨'])) return WEATHER_ICON_FILES.thunderstorm;
  if (includesAny(text, ['雨夹雪', '雨雪', '冻雨'])) return WEATHER_ICON_FILES.sleet;
  if (includesAny(text, ['暴雪', '大雪', '中雪'])) return WEATHER_ICON_FILES.heavySnow;
  if (includesAny(text, ['小雪', '阵雪', '雪'])) return WEATHER_ICON_FILES.lightSnow;
  if (includesAny(text, ['大暴雨', '特大暴雨', '暴雨', '大雨'])) {
    return WEATHER_ICON_FILES.heavyRain;
  }
  if (includesAny(text, ['中雨'])) return WEATHER_ICON_FILES.moderateRain;
  if (includesAny(text, ['小雨', '毛毛雨', '细雨', '阵雨', '雨'])) {
    return WEATHER_ICON_FILES.lightRain;
  }
  if (includesAny(text, ['沙尘', '浮尘', '扬沙', '霾'])) return WEATHER_ICON_FILES.hazeDust;
  if (includesAny(text, ['雾'])) return WEATHER_ICON_FILES.fog;
  if (includesAny(text, ['大风', '强风', '飓风', '热带风暴'])) return WEATHER_ICON_FILES.windy;
  if (includesAny(text, ['阴'])) return WEATHER_ICON_FILES.overcast;
  if (includesAny(text, ['多云', '少云', '晴间多云'])) {
    return isNight(dateTime, time)
      ? WEATHER_ICON_FILES.partlyCloudyNight
      : WEATHER_ICON_FILES.partlyCloudyDay;
  }
  if (includesAny(text, ['云'])) return WEATHER_ICON_FILES.cloudy;
  if (includesAny(text, ['晴'])) {
    return isNight(dateTime, time) ? WEATHER_ICON_FILES.clearNight : WEATHER_ICON_FILES.sunnyDay;
  }

  return WEATHER_ICON_FILES.unknown;
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function isNight(dateTime: string | undefined, time: WeatherIconTime) {
  if (time === 'day') return false;
  if (time === 'night') return true;
  const date = dateTime ? new Date(dateTime) : new Date();
  if (Number.isNaN(date.getTime())) return false;
  const hour = date.getHours();
  return hour < 6 || hour >= 19;
}

import type { WeatherApiResponse } from '@/api/weather';

export type WeatherAlert = {
  id: string;
  title: string;
  detail: string;
  tone: 'weather' | 'health' | 'alert';
};

const RAIN_KEYWORDS = ['雨', '雪', '雷', '阵雨', '雷阵雨'];

export function buildWeatherAlerts(weather: WeatherApiResponse): WeatherAlert[] {
  const temp = parseNumber(weather.now.temp);
  const high = parseNumber(weather.now.high);
  const low = parseNumber(weather.now.low);
  const tempGap = high !== null && low !== null ? high - low : 0;
  const windScale = parseNumber(weather.now.windScale);
  const alerts: WeatherAlert[] = [];

  if (high !== null && high >= 35) {
    alerts.push({
      id: 'heat',
      title: '高温提醒',
      detail: '午后尽量避开暴晒路段，外出补水并减少长时间户外停留。',
      tone: 'alert',
    });
  } else if (temp !== null && temp >= 32) {
    alerts.push({
      id: 'hot',
      title: '体感偏热',
      detail: '通勤和运动都建议放慢一点，随身带水更稳。',
      tone: 'health',
    });
  }

  if (low !== null && low <= 0) {
    alerts.push({
      id: 'cold',
      title: '低温提醒',
      detail: '早晚注意保暖，手脚和颈部别受凉。',
      tone: 'alert',
    });
  }

  if (tempGap >= 10) {
    alerts.push({
      id: 'temp-gap',
      title: '温差明显',
      detail: `今日温差约 ${Math.round(tempGap)}°，建议分层穿衣，晚归带外套。`,
      tone: 'weather',
    });
  }

  if (hasRainSignal(weather)) {
    alerts.push({
      id: 'rain',
      title: '降雨信号',
      detail: '出门带伞，开车或步行都给路上多留一点缓冲。',
      tone: 'weather',
    });
  }

  if (windScale !== null && windScale >= 6) {
    alerts.push({
      id: 'wind',
      title: '风力偏强',
      detail: '骑行和步行注意防风，尽量避开空旷路段。',
      tone: 'alert',
    });
  }

  if (isStrongUV(weather.now.uvIndex)) {
    alerts.push({
      id: 'uv',
      title: '紫外线偏强',
      detail: '防晒别省，午间外出建议帽子或遮阳伞一起上。',
      tone: 'health',
    });
  }

  if (
    weather.now.airQuality &&
    weather.now.airQuality !== '良' &&
    weather.now.airQuality !== '优'
  ) {
    alerts.push({
      id: 'air',
      title: '空气状态一般',
      detail: `当前空气${weather.now.airQuality}，减少高强度户外运动。`,
      tone: 'health',
    });
  }

  return alerts.slice(0, 3);
}

function hasRainSignal(weather: WeatherApiResponse) {
  const text = [weather.now.text, ...weather.hourly.slice(0, 4).map((item) => item.text)].join('');
  if (RAIN_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return true;
  }

  const precip = parseNumber(weather.now.precip);
  return precip !== null && weather.now.precip.includes('%') && precip >= 40;
}

function isStrongUV(value: string) {
  const normalized = value.trim();
  const numeric = parseNumber(normalized);
  return (
    (numeric !== null && numeric >= 6) || normalized.includes('强') || normalized.includes('高')
  );
}

function parseNumber(value: string) {
  const matched = value.match(/-?\d+(\.\d+)?/);
  return matched ? Number.parseFloat(matched[0]) : null;
}

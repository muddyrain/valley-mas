import type { WeatherApiResponse } from '@/api/weather';
import type { Advice, UserSettings } from '@/types';

type AdviceInput = {
  weather: WeatherApiResponse;
  settings: UserSettings;
  openPlanCount: number;
};

type WeatherAdvice = Omit<Advice, 'icon'>;

type WeatherBrief = {
  title: string;
  detail: string;
};

const RAIN_KEYWORDS = ['雨', '雪', '雷', '阵雨', '雷阵雨'];

export function buildWeatherDrivenAdvice({
  weather,
  settings,
  openPlanCount,
}: AdviceInput): WeatherAdvice[] {
  const temp = parseNumber(weather.now.temp);
  const high = parseNumber(weather.now.high);
  const low = parseNumber(weather.now.low);
  const tempGap = high !== null && low !== null ? high - low : 0;
  const rainy = hasRainSignal(weather);
  const windy =
    parseNumber(weather.now.windScale) !== null && Number.parseFloat(weather.now.windScale) >= 5;
  const uvStrong = isStrongUV(weather.now.uvIndex);
  const humid =
    parseNumber(weather.now.humidity) !== null && Number.parseFloat(weather.now.humidity) >= 75;
  const warm = temp !== null && temp >= 28;
  const cool = temp !== null && temp <= 18;

  return [
    {
      id: 'wear',
      title: '穿衣',
      detail: buildWearAdvice({ cool, warm, rainy, tempGap }),
      tone: 'plan',
    },
    {
      id: 'skin',
      title: '护肤',
      detail: buildSkinAdvice({ uvStrong, humid, warm }),
      tone: 'health',
    },
    {
      id: 'out',
      title: '出门',
      detail: buildOutAdvice({ rainy, windy, warm }),
      tone: rainy ? 'weather' : 'trace',
    },
    {
      id: 'commute',
      title: '通勤',
      detail: buildCommuteAdvice({ commuteMethod: settings.commuteMethod, rainy, windy }),
      tone: 'ai',
    },
    {
      id: 'health',
      title: '健康',
      detail: buildHealthAdvice({ humid, warm, airQuality: weather.now.airQuality }),
      tone: 'trace',
    },
    {
      id: 'plan',
      title: '今日计划',
      detail: openPlanCount > 0 ? `还有${openPlanCount}个生活计划` : '今天没有待办计划',
      tone: 'alert',
    },
  ];
}

export function buildWeatherBrief(
  weather: WeatherApiResponse,
  settings: UserSettings,
): WeatherBrief {
  const high = parseNumber(weather.now.high);
  const low = parseNumber(weather.now.low);
  const tempGap = high !== null && low !== null ? high - low : 0;
  const rainy = hasRainSignal(weather);
  const parts = [
    rainy ? '今天有降雨信号，出门记得带伞' : `${weather.now.text}为主，出门节奏可以放轻一点`,
    tempGap >= 8 ? '早晚温差明显，建议分层穿衣' : '温差整体可控',
    `${settings.commuteMethod}通勤建议预留一点缓冲时间`,
  ];

  return {
    title: rainy ? '今天出门多留一点余量' : '今天也适合慢慢变好',
    detail: `${parts.join('，')}。`,
  };
}

function buildWearAdvice({
  cool,
  warm,
  rainy,
  tempGap,
}: {
  cool: boolean;
  warm: boolean;
  rainy: boolean;
  tempGap: number;
}) {
  if (rainy && tempGap >= 8) {
    return '有雨且温差大，分层穿衣';
  }
  if (rainy) {
    return '有雨，外层选防水外套';
  }
  if (tempGap >= 8) {
    return '早晚温差大，分层穿衣';
  }
  if (warm) {
    return '气温偏高，轻薄透气';
  }
  if (cool) {
    return '体感偏凉，带薄外套';
  }
  return '温度舒适，常规穿搭';
}

function buildSkinAdvice({
  uvStrong,
  humid,
  warm,
}: {
  uvStrong: boolean;
  humid: boolean;
  warm: boolean;
}) {
  if (uvStrong && humid) {
    return '紫外线强，清爽防晒';
  }
  if (uvStrong) {
    return '紫外线偏强，注意防晒';
  }
  if (humid || warm) {
    return '湿热明显，清爽补水';
  }
  return '基础保湿，出门轻防晒';
}

function buildOutAdvice({ rainy, windy, warm }: { rainy: boolean; windy: boolean; warm: boolean }) {
  if (rainy) {
    return '降雨概率高，记得带伞';
  }
  if (windy) {
    return '风力偏大，注意防风';
  }
  if (warm) {
    return '午后偏热，少走暴晒路段';
  }
  return '天气平稳，轻装出门';
}

function buildCommuteAdvice({
  commuteMethod,
  rainy,
  windy,
}: {
  commuteMethod: UserSettings['commuteMethod'];
  rainy: boolean;
  windy: boolean;
}) {
  if (rainy || windy) {
    return `${commuteMethod}通勤，建议提前15分钟`;
  }
  return `${commuteMethod}通勤，提前10分钟更从容`;
}

function buildHealthAdvice({
  humid,
  warm,
  airQuality,
}: {
  humid: boolean;
  warm: boolean;
  airQuality: string;
}) {
  if (humid && warm) {
    return '湿热感强，注意补水休息';
  }
  if (airQuality && airQuality !== '良' && airQuality !== '优') {
    return `空气${airQuality}，减少高强度运动`;
  }
  return '空气状态不错，适合轻运动';
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

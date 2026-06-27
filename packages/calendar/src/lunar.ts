export interface LunarDateInfo {
  date: string;
  relatedYear: number;
  ganzhiYear: string;
  zodiacName: string;
  month: number;
  monthName: string;
  day: number;
  dayName: string;
  isLeapMonth: boolean;
  festivalName: string | null;
  displayName: string;
  detailLabel: string;
}

interface ParsedLunarDate {
  date: string;
  relatedYear: number;
  ganzhiYear: string;
  zodiacName: string;
  month: number;
  monthName: string;
  day: number;
  dayName: string;
  isLeapMonth: boolean;
}

const LUNAR_MONTHS = new Map([
  ['正月', 1],
  ['一月', 1],
  ['二月', 2],
  ['三月', 3],
  ['四月', 4],
  ['五月', 5],
  ['六月', 6],
  ['七月', 7],
  ['八月', 8],
  ['九月', 9],
  ['十月', 10],
  ['十一月', 11],
  ['冬月', 11],
  ['十二月', 12],
  ['腊月', 12],
]);

const LUNAR_DAY_NAMES = [
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
];

const ZODIAC_NAMES = ['猴', '鸡', '狗', '猪', '鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊'];

const LUNAR_FESTIVALS = new Map([
  ['1-1', '春节'],
  ['1-15', '元宵'],
  ['2-2', '龙抬头'],
  ['5-5', '端午'],
  ['7-7', '七夕'],
  ['7-15', '中元'],
  ['8-15', '中秋'],
  ['9-9', '重阳'],
  ['12-8', '腊八'],
  ['12-23', '北小年'],
  ['12-24', '南小年'],
]);

const lunarFormatter = createLunarFormatter();

export function getChineseLunarDate(input: string | Date): LunarDateInfo {
  const date = toLocalNoon(input);
  const parsed = parseLunarDate(date);
  const next = parseLunarDate(addDays(date, 1));
  const festivalName = getLunarFestival(parsed, next);
  const displayName = festivalName ?? (parsed.day === 1 ? parsed.monthName : parsed.dayName);
  const detailLabel = formatLunarDetail(parsed);

  return {
    ...parsed,
    festivalName,
    displayName,
    detailLabel,
  };
}

export function formatChineseLunarDate(input: string | Date): string {
  return getChineseLunarDate(input).detailLabel;
}

function createLunarFormatter() {
  try {
    return new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

function parseLunarDate(date: Date): ParsedLunarDate {
  if (!lunarFormatter) return fallbackLunarDate(date);

  const parts = lunarFormatter.formatToParts(date);
  const relatedYear = Number(partValue(parts, 'relatedYear')) || date.getFullYear();
  const ganzhiYear = partValue(parts, 'yearName') || '';
  const rawMonth = partValue(parts, 'month');
  const rawDay = partValue(parts, 'day');
  const isLeapMonth = rawMonth.startsWith('闰');
  const monthName = rawMonth.replace(/^闰/, '');
  const month = LUNAR_MONTHS.get(monthName) ?? 0;
  const day = Number(rawDay) || LUNAR_DAY_NAMES.indexOf(rawDay) + 1;
  const dayName = LUNAR_DAY_NAMES[day - 1] ?? rawDay;

  if (!month || !day) return fallbackLunarDate(date);

  return {
    date: formatDateKey(date),
    relatedYear,
    ganzhiYear,
    zodiacName: zodiacForYear(relatedYear),
    month,
    monthName: `${isLeapMonth ? '闰' : ''}${monthName}`,
    day,
    dayName,
    isLeapMonth,
  };
}

function partValue(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((part) => part.type === type)?.value ?? '';
}

function getLunarFestival(current: ParsedLunarDate, next: ParsedLunarDate) {
  if (!current.isLeapMonth) {
    const festival = LUNAR_FESTIVALS.get(`${current.month}-${current.day}`);
    if (festival) return festival;
  }

  if (current.month === 12 && next.month === 1 && next.day === 1) return '除夕';

  return null;
}

function formatLunarDetail(lunar: ParsedLunarDate) {
  const year = lunar.ganzhiYear ? `${lunar.ganzhiYear}年` : `${lunar.relatedYear}年`;
  return `农历${year}${lunar.monthName}${lunar.dayName}`;
}

function zodiacForYear(year: number) {
  return ZODIAC_NAMES[((year % 12) + 12) % 12] ?? '';
}

function toLocalNoon(input: string | Date) {
  if (typeof input === 'string') {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return new Date(input);
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12);
  }

  return new Date(input.getFullYear(), input.getMonth(), input.getDate(), 12);
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fallbackLunarDate(date: Date): ParsedLunarDate {
  return {
    date: formatDateKey(date),
    relatedYear: date.getFullYear(),
    ganzhiYear: '',
    zodiacName: zodiacForYear(date.getFullYear()),
    month: 0,
    monthName: '农历',
    day: 0,
    dayName: '',
    isLeapMonth: false,
  };
}

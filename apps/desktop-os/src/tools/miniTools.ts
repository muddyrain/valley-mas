export type ConverterGroupId = 'length' | 'weight' | 'temperature' | 'time' | 'data';

export interface ConverterUnit {
  id: string;
  label: string;
  factor?: number;
}

export interface ConverterGroup {
  id: ConverterGroupId;
  label: string;
  units: ConverterUnit[];
}

export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  lines: number;
}

export const CONVERTER_GROUPS: ConverterGroup[] = [
  {
    id: 'length',
    label: '长度',
    units: [
      { id: 'm', label: '米', factor: 1 },
      { id: 'km', label: '千米', factor: 1000 },
      { id: 'cm', label: '厘米', factor: 0.01 },
      { id: 'mm', label: '毫米', factor: 0.001 },
      { id: 'in', label: '英寸', factor: 0.0254 },
      { id: 'ft', label: '英尺', factor: 0.3048 },
    ],
  },
  {
    id: 'weight',
    label: '重量',
    units: [
      { id: 'kg', label: '千克', factor: 1 },
      { id: 'g', label: '克', factor: 0.001 },
      { id: 'lb', label: '磅', factor: 0.45359237 },
      { id: 'oz', label: '盎司', factor: 0.028349523125 },
    ],
  },
  {
    id: 'temperature',
    label: '温度',
    units: [
      { id: 'c', label: '摄氏度' },
      { id: 'f', label: '华氏度' },
      { id: 'k', label: '开尔文' },
    ],
  },
  {
    id: 'time',
    label: '时间',
    units: [
      { id: 'sec', label: '秒', factor: 1 },
      { id: 'min', label: '分钟', factor: 60 },
      { id: 'hour', label: '小时', factor: 3600 },
      { id: 'day', label: '天', factor: 86400 },
    ],
  },
  {
    id: 'data',
    label: '数据',
    units: [
      { id: 'byte', label: 'B', factor: 1 },
      { id: 'kb', label: 'KB', factor: 1024 },
      { id: 'mb', label: 'MB', factor: 1024 ** 2 },
      { id: 'gb', label: 'GB', factor: 1024 ** 3 },
    ],
  },
];

export function getConverterGroup(groupId: ConverterGroupId) {
  return CONVERTER_GROUPS.find((group) => group.id === groupId) ?? CONVERTER_GROUPS[0];
}

export function convertValue(
  rawValue: string,
  groupId: ConverterGroupId,
  fromUnitId: string,
  toUnitId: string,
) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return null;
  if (groupId === 'temperature') {
    return roundNumber(fromCelsius(toCelsius(value, fromUnitId), toUnitId));
  }

  const group = getConverterGroup(groupId);
  const from = group.units.find((unit) => unit.id === fromUnitId);
  const to = group.units.find((unit) => unit.id === toUnitId);
  if (!from?.factor || !to?.factor) return null;
  return roundNumber((value * from.factor) / to.factor);
}

export function getUnitLabel(groupId: ConverterGroupId, unitId: string) {
  return getConverterGroup(groupId).units.find((unit) => unit.id === unitId)?.label ?? unitId;
}

export function calculateTextStats(text: string): TextStats {
  const trimmed = text.trim();
  return {
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    lines: text ? text.split(/\r\n|\r|\n/).length : 0,
  };
}

export function transformText(text: string, action: string) {
  switch (action) {
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    case 'slug':
      return text
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '');
    case 'trim':
      return text
        .split(/\r\n|\r|\n/)
        .map((line) => line.trim().replace(/\s+/g, ' '))
        .join('\n')
        .trim();
    case 'encode':
      return encodeURIComponent(text);
    case 'decode':
      try {
        return decodeURIComponent(text);
      } catch {
        return text;
      }
    default:
      return text;
  }
}

export function normalizeHexColor(value: string) {
  const raw = value.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return null;
}

export function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const value = Number.parseInt(normalized.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function getContrastText(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#5A4A3A';
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 150 ? '#5A4A3A' : '#FFF8EC';
}

export function generatePalette(baseHex: string) {
  const rgb = hexToRgb(baseHex);
  if (!rgb) return [];
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return [-32, -14, 0, 18, 36].map((shift, index) =>
    hslToHex(
      (hsl.h + shift + 360) % 360,
      clamp(hsl.s + index * 0.02, 0.28, 0.7),
      clamp(hsl.l + (index - 2) * 0.045, 0.36, 0.78),
    ),
  );
}

function toCelsius(value: number, unit: string) {
  if (unit === 'f') return (value - 32) / 1.8;
  if (unit === 'k') return value - 273.15;
  return value;
}

function fromCelsius(value: number, unit: string) {
  if (unit === 'f') return value * 1.8 + 32;
  if (unit === 'k') return value + 273.15;
  return value;
}

function roundNumber(value: number) {
  return Number.parseFloat(value.toFixed(4));
}

function rgbToHsl(r: number, g: number, b: number) {
  const nextR = r / 255;
  const nextG = g / 255;
  const nextB = b / 255;
  const max = Math.max(nextR, nextG, nextB);
  const min = Math.min(nextR, nextG, nextB);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === nextR) h = (nextG - nextB) / d + (nextG < nextB ? 6 : 0);
  if (max === nextG) h = (nextB - nextR) / d + 2;
  if (max === nextB) h = (nextR - nextG) / d + 4;
  return { h: h * 60, s, l };
}

function hslToHex(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${[r, g, b]
    .map((value) =>
      Math.round((value + m) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type ConverterCategory = 'data' | 'encoding' | 'text';
export type ConverterDirection = 'forward' | 'reverse';

export interface FormatConverter {
  id: string;
  name: string;
  description: string;
  category: ConverterCategory;
  keywords: string[];
  supportsReverse: boolean;
  forwardActionLabel: string;
  reverseActionLabel?: string;
  inputPlaceholder: string;
  outputPlaceholder: string;
  convert: (input: string, direction: ConverterDirection) => string;
}

export const FORMAT_CONVERTER_CATEGORIES: Record<ConverterCategory, string> = {
  data: '数据',
  encoding: '编码',
  text: '文本',
};

function toJsonString(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function tryParseJson(input: string): unknown {
  return JSON.parse(input);
}

function encodeBase64(input: string): string {
  const maybeBuffer = (
    globalThis as {
      Buffer?: { from: (...args: unknown[]) => { toString: (encoding?: string) => string } };
    }
  ).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(input, 'utf8').toString('base64');
  }

  const maybeBtoa = (globalThis as { btoa?: (value: string) => string }).btoa;
  if (!maybeBtoa) {
    throw new Error('当前环境不支持 Base64 编码。');
  }

  const encoded = encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );

  return maybeBtoa(encoded);
}

function decodeBase64(input: string): string {
  const maybeBuffer = (
    globalThis as {
      Buffer?: { from: (...args: unknown[]) => { toString: (encoding?: string) => string } };
    }
  ).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(input, 'base64').toString('utf8');
  }

  const maybeAtob = (globalThis as { atob?: (value: string) => string }).atob;
  if (!maybeAtob) {
    throw new Error('当前环境不支持 Base64 解码。');
  }

  const decoded = maybeAtob(input);
  const encoded = Array.from(decoded)
    .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
    .join('');
  return decodeURIComponent(encoded);
}

function normalizeTimestamp(raw: string): Date {
  const value = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw new Error('请输入数字时间戳（秒或毫秒）。');
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error('时间戳超出可处理范围。');
  }

  const isMilliSeconds = Math.abs(numeric) >= 1_000_000_000_000;
  const ms = isMilliSeconds ? numeric : numeric * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    throw new Error('时间戳无法解析成日期。');
  }
  return date;
}

function formatDateInfo(date: Date): string {
  return [
    `ISO: ${date.toISOString()}`,
    `本地: ${date.toLocaleString('zh-CN', { hour12: false })}`,
  ].join('\n');
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function queryToJson(input: string): string {
  const query = input.trim().replace(/^\?/, '');
  const params = new URLSearchParams(query);
  const map: Record<string, string | string[]> = {};

  params.forEach((value, key) => {
    if (key in map) {
      const current = map[key];
      map[key] = Array.isArray(current) ? [...current, value] : [current, value];
      return;
    }
    map[key] = value;
  });

  return toJsonString(map);
}

function jsonToQuery(input: string): string {
  const parsed = tryParseJson(input);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('请输入 JSON 对象，例如 {"page":"1"}。');
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        search.append(key, String(item));
      });
      continue;
    }
    search.append(key, String(value));
  }

  return search.toString();
}

export const FORMAT_CONVERTER_LIST: FormatConverter[] = [
  {
    id: 'json-format',
    name: 'JSON 美化 / 压缩',
    description: '把 JSON 在可读格式和紧凑格式之间快速切换。',
    category: 'data',
    keywords: ['json', 'pretty', 'minify', '压缩', '格式化'],
    supportsReverse: true,
    forwardActionLabel: '美化 JSON',
    reverseActionLabel: '压缩 JSON',
    inputPlaceholder: '{\n  "title": "Valley",\n  "tags": ["web", "tools"]\n}',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input, direction) => {
      const parsed = tryParseJson(input);
      if (direction === 'reverse') return JSON.stringify(parsed);
      return toJsonString(parsed);
    },
  },
  {
    id: 'base64-text',
    name: 'Base64 与文本',
    description: '支持 UTF-8 文本与 Base64 双向转换。',
    category: 'encoding',
    keywords: ['base64', 'utf8', '编码', '解码'],
    supportsReverse: true,
    forwardActionLabel: '文本转 Base64',
    reverseActionLabel: 'Base64 转文本',
    inputPlaceholder: '请输入要编码或解码的内容',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input, direction) =>
      direction === 'reverse' ? decodeBase64(input) : encodeBase64(input),
  },
  {
    id: 'url-component',
    name: 'URL 编码',
    description: '对 URL 组件执行 encodeURIComponent / decodeURIComponent。',
    category: 'encoding',
    keywords: ['url', 'encodeURIComponent', 'decodeURIComponent', '参数'],
    supportsReverse: true,
    forwardActionLabel: 'URL 编码',
    reverseActionLabel: 'URL 解码',
    inputPlaceholder: '例如：name=valley mas&topic=格式转换',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input, direction) =>
      direction === 'reverse' ? decodeURIComponent(input) : encodeURIComponent(input),
  },
  {
    id: 'timestamp-date',
    name: '时间戳与日期',
    description: '在日期时间文本和 Unix 时间戳之间互转。',
    category: 'data',
    keywords: ['timestamp', 'date', 'unix', '时间戳', '日期'],
    supportsReverse: true,
    forwardActionLabel: '日期转时间戳',
    reverseActionLabel: '时间戳转日期',
    inputPlaceholder: '例如：2026-04-09 20:30:00 或 1744201800',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input, direction) => {
      if (direction === 'reverse') {
        return formatDateInfo(normalizeTimestamp(input));
      }
      const date = new Date(input);
      if (Number.isNaN(date.getTime())) {
        throw new Error('请输入可识别的日期时间文本。');
      }
      return Math.floor(date.getTime() / 1000).toString();
    },
  },
  {
    id: 'query-json',
    name: 'Query 与 JSON',
    description: 'URL 查询参数与 JSON 对象互转。',
    category: 'data',
    keywords: ['query', 'json', 'search params', '参数'],
    supportsReverse: true,
    forwardActionLabel: 'Query 转 JSON',
    reverseActionLabel: 'JSON 转 Query',
    inputPlaceholder: '例如：page=1&pageSize=20&tag=ai',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input, direction) =>
      direction === 'reverse' ? jsonToQuery(input) : queryToJson(input),
  },
  {
    id: 'markdown-plain',
    name: 'Markdown 转纯文本',
    description: '去除 Markdown 标记，得到可复制的纯文本。',
    category: 'text',
    keywords: ['markdown', 'plain text', '文本'],
    supportsReverse: false,
    forwardActionLabel: '转为纯文本',
    inputPlaceholder: '# 标题\n- 列表项\n[链接](https://example.com)',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input) => markdownToPlainText(input),
  },
];

export function getFormatConverterById(id: string): FormatConverter | undefined {
  return FORMAT_CONVERTER_LIST.find((item) => item.id === id);
}

export function runFormatConverter(params: {
  converterId: string;
  input: string;
  direction?: ConverterDirection;
}): { ok: boolean; output: string; error?: string } {
  const { converterId, input, direction = 'forward' } = params;
  const converter = getFormatConverterById(converterId);
  if (!converter) {
    return { ok: false, output: '', error: '未找到对应的转换器。' };
  }

  if (direction === 'reverse' && !converter.supportsReverse) {
    return { ok: false, output: '', error: '该转换器不支持反向转换。' };
  }

  try {
    return {
      ok: true,
      output: converter.convert(input, direction),
    };
  } catch (error) {
    return {
      ok: false,
      output: '',
      error: error instanceof Error ? error.message : '转换失败，请检查输入内容。',
    };
  }
}

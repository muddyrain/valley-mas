import {
  getStructuredFormatToolById,
  runStructuredFormatTool,
  STRUCTURED_FORMAT_TOOL_LIST,
} from './structured-tools';

export type ConverterCategory = 'data' | 'encoding' | 'text' | 'crypto';
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
  convert: (input: string, direction: ConverterDirection) => string | Promise<string>;
}

export interface FormatToolManifest {
  name: 'format.convert';
  description: string;
  converters: Array<{
    id: string;
    name: string;
    description: string;
    category: ConverterCategory;
    keywords: string[];
    supportsReverse: boolean;
    optionsSchema?: Record<string, unknown>;
  }>;
  inputSchema: {
    type: 'object';
    required: string[];
    properties: {
      toolId: { type: 'string'; enum: string[] };
      input: { type: 'string' };
      direction: { type: 'string'; enum: ConverterDirection[] };
      options: { type: 'object'; additionalProperties: true };
    };
  };
}

export const FORMAT_CONVERTER_CATEGORIES: Record<ConverterCategory, string> = {
  data: '数据',
  encoding: '编码',
  text: '文本',
  crypto: '加密',
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

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('CSV 中存在未闭合的引号。');
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.length > 0));
}

function csvToJson(input: string): string {
  const [header, ...rows] = parseCsvRows(input.trim());
  if (!header?.length) throw new Error('请输入包含表头的 CSV 内容。');
  const normalizedHeader = header.map((value) => value.trim());
  if (normalizedHeader.some((value) => !value)) throw new Error('CSV 表头不能为空。');
  if (new Set(normalizedHeader).size !== normalizedHeader.length) {
    throw new Error('CSV 表头不能包含重复字段。');
  }

  const result = rows.map((row, rowIndex) => {
    if (row.length > normalizedHeader.length) {
      throw new Error(`CSV 第 ${rowIndex + 2} 行的字段数量超过表头。`);
    }
    return Object.fromEntries(normalizedHeader.map((key, index) => [key, row[index] ?? '']));
  });
  return toJsonString(result);
}

function escapeCsvField(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function jsonToCsv(input: string): string {
  const parsed = tryParseJson(input);
  if (!Array.isArray(parsed)) throw new Error('请输入由对象组成的 JSON 数组。');
  if (parsed.length === 0) return '';
  if (parsed.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('JSON 数组中的每一项都必须是对象。');
  }

  const headers: string[] = [];
  const seen = new Set<string>();
  for (const item of parsed as Array<Record<string, unknown>>) {
    for (const key of Object.keys(item)) {
      if (seen.has(key)) continue;
      seen.add(key);
      headers.push(key);
    }
  }
  const lines = [headers.map(escapeCsvField).join(',')];
  for (const item of parsed as Array<Record<string, unknown>>) {
    lines.push(
      headers
        .map((key) => {
          const value = item[key];
          return escapeCsvField(
            typeof value === 'object' && value !== null ? JSON.stringify(value) : value,
          );
        })
        .join(','),
    );
  }
  return lines.join('\n');
}

function jsonLinesToJson(input: string): string {
  const lines = normalizeLines(input).filter((line) => line.trim());
  if (lines.length === 0) throw new Error('请输入每行一条 JSON 的内容。');
  return toJsonString(
    lines.map((line, index) => {
      try {
        return tryParseJson(line);
      } catch {
        throw new Error(`第 ${index + 1} 行不是有效的 JSON。`);
      }
    }),
  );
}

function jsonToJsonLines(input: string): string {
  const parsed = tryParseJson(input);
  if (!Array.isArray(parsed)) throw new Error('请输入 JSON 数组。');
  return parsed.map((item) => JSON.stringify(item)).join('\n');
}

function inspectUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('请输入包含协议的完整 URL，例如 https://example.com/path。');
  }

  const query: Record<string, string | string[]> = {};
  url.searchParams.forEach((value, key) => {
    const current = query[key];
    query[key] =
      current === undefined
        ? value
        : Array.isArray(current)
          ? [...current, value]
          : [current, value];
  });
  return toJsonString({
    protocol: url.protocol,
    username: url.username,
    password: url.password,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    origin: url.origin,
    query,
  });
}

function textStatistics(input: string): string {
  const characters = Array.from(input);
  const segmenter = (
    Intl as typeof Intl & {
      Segmenter?: new (
        locale?: string,
        options?: { granularity: 'word' },
      ) => {
        segment: (value: string) => Iterable<{ isWordLike?: boolean }>;
      };
    }
  ).Segmenter;
  const words = segmenter
    ? Array.from(new segmenter('zh-CN', { granularity: 'word' }).segment(input)).filter(
        (segment) => segment.isWordLike,
      ).length
    : (input.match(/[\p{L}\p{N}]+/gu) ?? []).length;

  return toJsonString({
    characters: characters.length,
    charactersWithoutSpaces: characters.filter((character) => !/\s/u.test(character)).length,
    words,
    lines: normalizeLines(input).length,
    paragraphs: input.trim() ? input.trim().split(/\n\s*\n/u).length : 0,
    bytes: new TextEncoder().encode(input).length,
  });
}

function base64UrlEncode(input: string): string {
  return encodeBase64(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = normalized.length % 4;
  const withPadding = remainder === 0 ? normalized : `${normalized}${'='.repeat(4 - remainder)}`;
  return decodeBase64(withPadding);
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HTML_UNESCAPE_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function encodeHtmlEntities(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

function decodeHtmlEntities(input: string): string {
  let text = input;
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16)),
  );
  text = text.replace(/&#([0-9]+);/g, (_, code: string) =>
    String.fromCodePoint(Number.parseInt(code, 10)),
  );
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (entity) => HTML_UNESCAPE_MAP[entity] || entity);
}

function textToUnicodeEscape(input: string): string {
  return Array.from(input)
    .map((char) => {
      const codePoint = char.codePointAt(0);
      if (!codePoint) return char;
      if (codePoint <= 0x7f) return char;
      if (codePoint <= 0xffff) return `\\u${codePoint.toString(16).padStart(4, '0')}`;
      return `\\u{${codePoint.toString(16)}}`;
    })
    .join('');
}

function unicodeEscapeToText(input: string): string {
  return input.replace(
    /\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g,
    (_, unicodeBrace: string, unicode: string, hex: string) => {
      const source = unicodeBrace || unicode || hex;
      const codePoint = Number.parseInt(source, 16);
      if (!Number.isFinite(codePoint)) return _;
      return String.fromCodePoint(codePoint);
    },
  );
}

function normalizeLines(input: string): string[] {
  return input.replace(/\r\n/g, '\n').split('\n');
}

function sortLines(input: string, direction: ConverterDirection): string {
  const sorted = normalizeLines(input).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  if (direction === 'reverse') sorted.reverse();
  return sorted.join('\n');
}

function dedupeLines(input: string): string {
  const lines = normalizeLines(input);
  const seen = new Set<string>();
  const unique = lines.filter((line) => {
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  });
  return unique.join('\n');
}

function formatXml(input: string): string {
  const compact = input.replace(/>\s+</g, '><').trim();
  if (!compact) return '';
  const tokens = compact.replace(/</g, '\n<').trim().split('\n');
  let indent = 0;
  const lines: string[] = [];

  tokens.forEach((token) => {
    const text = token.trim();
    if (!text) return;
    const isClosing = /^<\//.test(text);
    const isDeclaration = /^<\?/.test(text) || /^<!/.test(text);
    const isSelfClosing = /\/>$/.test(text);

    if (isClosing) indent = Math.max(0, indent - 1);
    lines.push(`${'  '.repeat(indent)}${text}`);
    if (!isClosing && !isSelfClosing && !isDeclaration) indent += 1;
  });

  return lines.join('\n');
}

function compactXml(input: string): string {
  return input.replace(/>\s+</g, '><').replace(/\n/g, '').trim();
}

function decodeJwtPart(part: string, partName: 'Header' | 'Payload'): unknown {
  if (!part) throw new Error(`JWT ${partName} 为空。`);
  const decoded = base64UrlDecode(part);
  return JSON.parse(decoded);
}

async function digestText(input: string, algorithm: 'SHA-256' | 'SHA-1'): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('当前环境不支持 Web Crypto，无法生成摘要。');
  }
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await subtle.digest(algorithm, bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
    id: 'csv-json',
    name: 'CSV 与 JSON',
    description: '在带表头的 CSV 和 JSON 对象数组之间双向转换。',
    category: 'data',
    keywords: ['csv', 'json', '表格', '数据转换'],
    supportsReverse: true,
    forwardActionLabel: 'CSV 转 JSON',
    reverseActionLabel: 'JSON 转 CSV',
    inputPlaceholder: 'name,role\nValley,creator',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input, direction) => (direction === 'reverse' ? jsonToCsv(input) : csvToJson(input)),
  },
  {
    id: 'jsonl-json',
    name: 'JSON Lines 与 JSON',
    description: '在逐行 JSON（JSONL）和标准 JSON 数组之间转换。',
    category: 'data',
    keywords: ['jsonl', 'ndjson', 'json lines', '日志'],
    supportsReverse: true,
    forwardActionLabel: 'JSONL 转 JSON',
    reverseActionLabel: 'JSON 转 JSONL',
    inputPlaceholder: '{"id":1}\n{"id":2}',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input, direction) =>
      direction === 'reverse' ? jsonToJsonLines(input) : jsonLinesToJson(input),
  },
  {
    id: 'url-inspect',
    name: 'URL 解析',
    description: '拆解协议、主机、路径、查询参数和锚点。',
    category: 'data',
    keywords: ['url', 'host', 'path', 'query', '链接解析'],
    supportsReverse: false,
    forwardActionLabel: '解析 URL',
    inputPlaceholder: 'https://example.com/docs?q=valley#intro',
    outputPlaceholder: '这里会显示 URL 结构',
    convert: (input) => inspectUrl(input),
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
  {
    id: 'base64url-text',
    name: 'Base64URL 与文本',
    description: '支持 URL 安全版本 Base64（JWT 常用）与文本互转。',
    category: 'encoding',
    keywords: ['base64url', 'jwt', '编码', '解码'],
    supportsReverse: true,
    forwardActionLabel: '文本转 Base64URL',
    reverseActionLabel: 'Base64URL 转文本',
    inputPlaceholder: '请输入要编码或解码的内容',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input, direction) =>
      direction === 'reverse' ? base64UrlDecode(input) : base64UrlEncode(input),
  },
  {
    id: 'unicode-escape',
    name: 'Unicode 转义',
    description: '在文本和 Unicode 转义（\\uXXXX）之间互转。',
    category: 'encoding',
    keywords: ['unicode', 'escape', '中文转义', '\\u'],
    supportsReverse: true,
    forwardActionLabel: '文本转 Unicode',
    reverseActionLabel: 'Unicode 转文本',
    inputPlaceholder: '例如：你好，Valley!',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input, direction) =>
      direction === 'reverse' ? unicodeEscapeToText(input) : textToUnicodeEscape(input),
  },
  {
    id: 'html-entity',
    name: 'HTML 实体编解码',
    description: 'HTML 特殊字符与实体编码互转。',
    category: 'encoding',
    keywords: ['html', 'entity', '&amp;', '转义'],
    supportsReverse: true,
    forwardActionLabel: '文本转 HTML 实体',
    reverseActionLabel: 'HTML 实体转文本',
    inputPlaceholder: '<h1>Valley & Co.</h1>',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input, direction) =>
      direction === 'reverse' ? decodeHtmlEntities(input) : encodeHtmlEntities(input),
  },
  {
    id: 'sha256-hash',
    name: 'SHA-256 摘要',
    description: '把文本转换为 SHA-256 十六进制摘要。',
    category: 'crypto',
    keywords: ['sha256', 'hash', '摘要', '加密'],
    supportsReverse: false,
    forwardActionLabel: '生成 SHA-256',
    inputPlaceholder: '输入任意文本生成摘要',
    outputPlaceholder: '这里会显示转换结果',
    convert: async (input) => digestText(input, 'SHA-256'),
  },
  {
    id: 'sha1-hash',
    name: 'SHA-1 摘要',
    description: '把文本转换为 SHA-1 十六进制摘要（兼容旧系统）。',
    category: 'crypto',
    keywords: ['sha1', 'hash', '摘要', '旧系统'],
    supportsReverse: false,
    forwardActionLabel: '生成 SHA-1',
    inputPlaceholder: '输入任意文本生成摘要',
    outputPlaceholder: '这里会显示转换结果',
    convert: async (input) => digestText(input, 'SHA-1'),
  },
  {
    id: 'jwt-decode',
    name: 'JWT 解析',
    description: '解析 JWT 的 Header 与 Payload（仅解析，不验签）。',
    category: 'crypto',
    keywords: ['jwt', 'token', 'decode', 'payload'],
    supportsReverse: false,
    forwardActionLabel: '解析 JWT',
    inputPlaceholder: '粘贴 JWT 字符串（header.payload.signature）',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input) => {
      const trimmed = input.trim();
      const parts = trimmed.split('.');
      if (parts.length < 2) {
        throw new Error('请输入有效的 JWT，格式应为 header.payload.signature。');
      }

      const header = decodeJwtPart(parts[0], 'Header');
      const payload = decodeJwtPart(parts[1], 'Payload');
      return toJsonString({
        header,
        payload,
        signatureLength: parts[2]?.length ?? 0,
      });
    },
  },
  {
    id: 'line-sort',
    name: '文本行排序',
    description: '按行排序文本，支持正序与倒序切换。',
    category: 'text',
    keywords: ['排序', 'line', 'sort', '文本'],
    supportsReverse: true,
    forwardActionLabel: '正序排序',
    reverseActionLabel: '倒序排序',
    inputPlaceholder: '每行一条内容',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input, direction) => sortLines(input, direction),
  },
  {
    id: 'line-dedupe',
    name: '文本行去重',
    description: '按行去重并保留第一次出现的顺序。',
    category: 'text',
    keywords: ['去重', 'line', 'dedupe', '文本'],
    supportsReverse: false,
    forwardActionLabel: '去重文本行',
    inputPlaceholder: '每行一条内容',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input) => dedupeLines(input),
  },
  {
    id: 'text-statistics',
    name: '文本统计',
    description: '统计字符、字词、行、段落和 UTF-8 字节数。',
    category: 'text',
    keywords: ['字符数', '字数', '词数', '行数', 'bytes'],
    supportsReverse: false,
    forwardActionLabel: '统计文本',
    inputPlaceholder: '输入需要统计的文本',
    outputPlaceholder: '这里会显示统计结果',
    convert: (input) => textStatistics(input),
  },
  {
    id: 'xml-format',
    name: 'XML 美化 / 压缩',
    description: '在 XML 可读格式和紧凑格式之间快速切换。',
    category: 'data',
    keywords: ['xml', 'format', 'minify', '美化'],
    supportsReverse: true,
    forwardActionLabel: '美化 XML',
    reverseActionLabel: '压缩 XML',
    inputPlaceholder: '<root><item id="1">Valley</item></root>',
    outputPlaceholder: '这里会显示转换结果',
    convert: (input, direction) => (direction === 'reverse' ? compactXml(input) : formatXml(input)),
  },
];

export function getFormatConverterById(id: string): FormatConverter | undefined {
  return FORMAT_CONVERTER_LIST.find((item) => item.id === id);
}

export async function runFormatConverter(params: {
  converterId: string;
  input: string;
  direction?: ConverterDirection;
}): Promise<{ ok: boolean; output: string; error?: string }> {
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
      output: await converter.convert(input, direction),
    };
  } catch (error) {
    return {
      ok: false,
      output: '',
      error: error instanceof Error ? error.message : '转换失败，请检查输入内容。',
    };
  }
}

export function getFormatToolManifest(): FormatToolManifest {
  const structuredConverters = STRUCTURED_FORMAT_TOOL_LIST.map((tool) => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    keywords: [...tool.keywords],
    supportsReverse: false,
    optionsSchema: tool.optionsSchema,
  }));
  const converters = [
    ...FORMAT_CONVERTER_LIST.map((converter) => ({
      id: converter.id,
      name: converter.name,
      description: converter.description,
      category: converter.category,
      keywords: [...converter.keywords],
      supportsReverse: converter.supportsReverse,
    })),
    ...structuredConverters,
  ];
  const ids = converters.map((converter) => converter.id);

  return {
    name: 'format.convert',
    description:
      'Convert, parse, format, encode, normalize, hash, or inspect text and structured data.',
    converters,
    inputSchema: {
      type: 'object',
      required: ['toolId', 'input'],
      properties: {
        toolId: { type: 'string', enum: ids },
        input: { type: 'string' },
        direction: { type: 'string', enum: ['forward', 'reverse'] },
        options: { type: 'object', additionalProperties: true },
      },
    },
  };
}

export async function runFormatTool(params: {
  toolId: string;
  input: string;
  direction?: ConverterDirection;
  options?: Record<string, unknown>;
}): Promise<{ ok: boolean; output: string; error?: string }> {
  if (getStructuredFormatToolById(params.toolId)) {
    return runStructuredFormatTool(params);
  }
  return runFormatConverter({
    converterId: params.toolId,
    input: params.input,
    direction: params.direction,
  });
}

export * from './structured-tools';
export * from './toolbox';

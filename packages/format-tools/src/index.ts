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

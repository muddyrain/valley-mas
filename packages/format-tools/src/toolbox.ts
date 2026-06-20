export interface ToolResult {
  ok: boolean;
  output: string;
  message: string;
}

export interface TimestampInfo {
  iso: string;
  utc: string;
  local: string;
  seconds: string;
  milliseconds: string;
}

export interface DiffLine {
  id: string;
  type: 'same' | 'added' | 'removed' | 'changed';
  left: string;
  right: string;
}

export interface DateDiffResult {
  days: number;
  hours: number;
  minutes: number;
  label: string;
}

export interface SplitBillPerson {
  id: string;
  name: string;
  paid: number;
}

export interface SplitBillResult {
  total: number;
  perPerson: number;
  rows: Array<{
    id: string;
    name: string;
    paid: number;
    balance: number;
    label: string;
  }>;
}

export interface PasswordOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  numbers: boolean;
  symbols: boolean;
  readable: boolean;
}

const READABLE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function formatJson(input: string, compact = false): ToolResult {
  try {
    const value = JSON.parse(input);
    return {
      ok: true,
      output: JSON.stringify(value, null, compact ? 0 : 2),
      message: compact ? '已压缩' : '已格式化',
    };
  } catch (error) {
    return {
      ok: false,
      output: '',
      message: error instanceof Error ? error.message : 'JSON 无效',
    };
  }
}

export function compactJson(input: string): ToolResult {
  return formatJson(input, true);
}

export function jsonToQueryString(input: string): ToolResult {
  try {
    const value = JSON.parse(input);
    if (!isRecord(value)) return { ok: false, output: '', message: '需要 JSON 对象' };
    const params = new URLSearchParams();
    for (const [key, item] of Object.entries(value)) {
      if (item == null) continue;
      if (Array.isArray(item)) {
        for (const entry of item) {
          params.append(key, stringifyQueryValue(entry));
        }
      } else {
        params.set(key, stringifyQueryValue(item));
      }
    }
    return { ok: true, output: params.toString(), message: '已转换' };
  } catch (error) {
    return {
      ok: false,
      output: '',
      message: error instanceof Error ? error.message : 'JSON 无效',
    };
  }
}

export function queryStringToJson(input: string): ToolResult {
  const query = input.trim().replace(/^\?/, '');
  const params = new URLSearchParams(query);
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of params.entries()) {
    const current = result[key];
    if (Array.isArray(current)) current.push(value);
    else if (current != null) result[key] = [current, value];
    else result[key] = value;
  }
  return { ok: true, output: JSON.stringify(result, null, 2), message: '已转换' };
}

export function readTimestamp(input: string): ToolResult & { info?: TimestampInfo } {
  const date = parseDateTimeInput(input);
  if (!date) return { ok: false, output: '', message: '时间无效' };
  const info = createTimestampInfo(date);
  return {
    ok: true,
    output: [
      `ISO: ${info.iso}`,
      `UTC: ${info.utc}`,
      `本地: ${info.local}`,
      `秒: ${info.seconds}`,
      `毫秒: ${info.milliseconds}`,
    ].join('\n'),
    message: '已解析',
    info,
  };
}

export function shiftDate(input: string, amount: number, unit: string): TimestampInfo | null {
  const date = parseDateTimeInput(input);
  if (!date || !Number.isFinite(amount)) return null;
  const next = new Date(date);
  if (unit === 'minute') next.setMinutes(next.getMinutes() + amount);
  else if (unit === 'hour') next.setHours(next.getHours() + amount);
  else if (unit === 'month') next.setMonth(next.getMonth() + amount);
  else next.setDate(next.getDate() + amount);
  return createTimestampInfo(next);
}

export function nowTimestampInput(): string {
  return String(Date.now());
}

export function utf8ToBase64(input: string): string {
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

export function base64ToUtf8(input: string): ToolResult {
  try {
    return {
      ok: true,
      output: decodeBase64(input.trim()),
      message: '已解码',
    };
  } catch {
    return { ok: false, output: '', message: 'Base64 无效' };
  }
}

export function decodeUnicodeEscapes(input: string): string {
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

export function encodeHtmlEntities(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function decodeHtmlEntities(input: string): string {
  let text = input;
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16)),
  );
  text = text.replace(/&#([0-9]+);/g, (_, code: string) =>
    String.fromCodePoint(Number.parseInt(code, 10)),
  );
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function decodeJwt(input: string): ToolResult {
  const [header, payload] = input.trim().split('.');
  if (!header || !payload) return { ok: false, output: '', message: 'JWT 无效' };
  try {
    const decoded = {
      header: JSON.parse(base64UrlDecode(header)),
      payload: JSON.parse(base64UrlDecode(payload)),
    };
    return { ok: true, output: JSON.stringify(decoded, null, 2), message: '已解码' };
  } catch {
    return { ok: false, output: '', message: 'JWT 无效' };
  }
}

export function generateUuidV4(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) return randomUUID.call(globalThis.crypto);
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createUuid(): string {
  return generateUuidV4();
}

export function createToken(length = 32): string {
  return randomString(READABLE_ALPHABET, length);
}

export function generateRandomToken(length = 32): string {
  return createToken(length);
}

export function createPassword(length: number, readable = false): string {
  const alphabet = readable
    ? READABLE_ALPHABET
    : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  return randomString(alphabet, length);
}

export function generatePassword(options: PasswordOptions): string {
  const pools = [];
  if (options.upper) pools.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  if (options.lower) pools.push('abcdefghijklmnopqrstuvwxyz');
  if (options.numbers) pools.push('0123456789');
  if (options.symbols) pools.push('!@#$%^&*()-_=+[]{}');
  const alphabet = options.readable ? READABLE_ALPHABET : pools.join('') || READABLE_ALPHABET;
  return randomString(alphabet, Math.max(4, options.length));
}

export async function digestText(input: string, algorithm: 'SHA-1' | 'SHA-256'): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('当前环境不支持 Web Crypto，无法生成摘要。');
  }
  const bytes = new TextEncoder().encode(input);
  const digest = await subtle.digest(algorithm, bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function diffLines(left: string, right: string, trim = false): DiffLine[] {
  const leftLines = left.split(/\r\n|\r|\n/);
  const rightLines = right.split(/\r\n|\r|\n/);
  const max = Math.max(leftLines.length, rightLines.length);
  return Array.from({ length: max }, (_, index) => {
    const leftLine = leftLines[index] ?? '';
    const rightLine = rightLines[index] ?? '';
    const compareLeft = trim ? leftLine.trim() : leftLine;
    const compareRight = trim ? rightLine.trim() : rightLine;
    const type =
      index >= leftLines.length
        ? 'added'
        : index >= rightLines.length
          ? 'removed'
          : compareLeft === compareRight
            ? 'same'
            : 'changed';
    return { id: `diff-${index}`, type, left: leftLine, right: rightLine };
  });
}

export function csvToJson(input: string, delimiter = ','): ToolResult {
  const rows = parseDelimited(input, delimiter);
  if (rows.length < 2) return { ok: false, output: '', message: '至少需要表头和一行数据' };
  const [headers, ...body] = rows;
  const data = body.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header || `field_${index + 1}`, row[index] ?? '']),
    ),
  );
  return { ok: true, output: JSON.stringify(data, null, 2), message: '已转换' };
}

export function jsonArrayToCsv(input: string): ToolResult {
  try {
    const value = JSON.parse(input);
    if (!Array.isArray(value) || !value.every(isRecord)) {
      return { ok: false, output: '', message: '需要 JSON 对象数组' };
    }
    const headers = Array.from(new Set(value.flatMap((item) => Object.keys(item))));
    const rows = [
      headers,
      ...value.map((item) => headers.map((header) => stringifyCsvCell(item[header]))),
    ];
    return { ok: true, output: rows.map((row) => row.join(',')).join('\n'), message: '已转换' };
  } catch (error) {
    return {
      ok: false,
      output: '',
      message: error instanceof Error ? error.message : 'JSON 无效',
    };
  }
}

export function csvToMarkdownTable(input: string, delimiter = ','): ToolResult {
  const rows = parseDelimited(input, delimiter);
  if (rows.length === 0) return { ok: false, output: '', message: '表格为空' };
  const [headers, ...body] = rows;
  const safeHeaders = headers.map((header, index) => header || `列 ${index + 1}`);
  const divider = safeHeaders.map(() => '---');
  const output = [safeHeaders, divider, ...body]
    .map((row) => `| ${row.map((cell) => cell.replace(/\|/g, '\\|')).join(' | ')} |`)
    .join('\n');
  return { ok: true, output, message: '已转换' };
}

export function diffDates(startValue: string, endValue: string): DateDiffResult | null {
  const start = parseDateInput(startValue);
  const end = parseDateInput(endValue);
  if (!start || !end) return null;
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  const absMinutes = Math.abs(minutes);
  const days = Math.floor(absMinutes / 1440);
  const hours = Math.floor((absMinutes % 1440) / 60);
  const restMinutes = absMinutes % 60;
  const prefix = minutes >= 0 ? '相差' : '已过';
  return {
    days,
    hours,
    minutes: restMinutes,
    label: `${prefix} ${days} 天 ${hours} 小时 ${restMinutes} 分钟`,
  };
}

export function calculateDateDiff(startValue: string, endValue: string): DateDiffResult | null {
  return diffDates(startValue, endValue);
}

export function addDateAmount(dateValue: string, amount: number, unit: string): string | null {
  const date = parseDateInput(dateValue);
  if (!date || !Number.isFinite(amount)) return null;
  const next = new Date(date);
  if (unit === 'week') next.setDate(next.getDate() + amount * 7);
  else if (unit === 'month') next.setMonth(next.getMonth() + amount);
  else if (unit === 'year') next.setFullYear(next.getFullYear() + amount);
  else next.setDate(next.getDate() + amount);
  return formatDateInput(next);
}

export function todayInput(): string {
  return formatDateInput(new Date());
}

export function calculateSplitBill(
  baseTotal: number,
  tip: number,
  tax: number,
  people: SplitBillPerson[],
): SplitBillResult | null {
  const activePeople = people.filter((person) => person.name.trim());
  if (!Number.isFinite(baseTotal) || activePeople.length === 0) return null;
  const total = Math.max(0, baseTotal) + Math.max(0, tip) + Math.max(0, tax);
  const perPerson = total / activePeople.length;
  return {
    total,
    perPerson,
    rows: activePeople.map((person) => {
      const balance = person.paid - perPerson;
      return {
        ...person,
        balance,
        label:
          Math.abs(balance) < 0.01
            ? '已结清'
            : balance > 0
              ? `应收 ${formatMoney(balance)}`
              : `应补 ${formatMoney(Math.abs(balance))}`,
      };
    }),
  };
}

export function formatMoney(value: number): string {
  return value.toFixed(2);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function parseDateTimeInput(input: string): Date | null {
  const value = input.trim();
  if (!value) return new Date();
  if (/^-?\d+$/.test(value)) {
    const num = Number(value);
    const millis = Math.abs(num) < 10_000_000_000 ? num * 1000 : num;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateInput(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function createTimestampInfo(date: Date): TimestampInfo {
  return {
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toLocaleString('zh-CN', { hour12: false }),
    seconds: String(Math.floor(date.getTime() / 1000)),
    milliseconds: String(date.getTime()),
  };
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function stringifyQueryValue(value: unknown): string {
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
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

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = normalized.length % 4;
  const withPadding = remainder === 0 ? normalized : `${normalized}${'='.repeat(4 - remainder)}`;
  return decodeBase64(withPadding);
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues) {
    throw new Error('当前环境不支持安全随机数。');
  }
  crypto.getRandomValues(bytes);
  return bytes;
}

function randomString(alphabet: string, length: number): string {
  const bytes = randomBytes(Math.max(1, length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function parseDelimited(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((item) => item.length > 0)) rows.push(row);
  return rows;
}

function stringifyCsvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

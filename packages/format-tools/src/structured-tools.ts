export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonParseResult = { ok: true; value: JsonValue } | { ok: false; error: string };
export type TextCase =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'constant';

export interface NormalizeTextOptions {
  trimLines?: boolean;
  trimDocument?: boolean;
  collapseBlankLines?: boolean;
  collapseInlineWhitespace?: boolean;
  removeEmptyLines?: boolean;
}

export interface StructuredFormatTool {
  id: string;
  name: string;
  description: string;
  category: 'data' | 'text';
  keywords: string[];
  optionsSchema?: Record<string, unknown>;
  run: (input: string, options?: Record<string, unknown>) => string | Promise<string>;
}

export interface StructuredFormatToolResult {
  ok: boolean;
  output: string;
  error?: string;
}

export function parseJsonDocument(input: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(input) as JsonValue };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid JSON input.',
    };
  }
}

export function sortJsonKeys<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonKeys(item)) as T;
  }
  if (!isJsonObject(value)) return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, sortJsonKeys(value[key])]),
  ) as T;
}

export function getJsonPointer(
  value: JsonValue,
  pointer: string,
): { found: true; value: JsonValue } | { found: false } {
  if (pointer === '') return { found: true, value };
  if (!pointer.startsWith('/')) throw new Error('JSON Pointer must be empty or start with "/".');

  let current: JsonValue = value;
  for (const encodedToken of pointer.slice(1).split('/')) {
    const token = encodedToken.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(token)) return { found: false };
      const index = Number(token);
      if (index >= current.length) return { found: false };
      current = current[index];
      continue;
    }
    if (!isJsonObject(current) || !Object.hasOwn(current, token)) return { found: false };
    current = current[token];
  }
  return { found: true, value: current };
}

export function convertTextCase(input: string, target: TextCase): string {
  if (target === 'upper') return input.toLocaleUpperCase();
  if (target === 'lower') return input.toLocaleLowerCase();

  const words = tokenizeWords(input);
  if (words.length === 0) return '';
  const lowerWords = words.map((word) => word.toLocaleLowerCase());
  const capitalizedWords = lowerWords.map(capitalizeWord);

  switch (target) {
    case 'title':
      return capitalizedWords.join(' ');
    case 'sentence':
      return [capitalizeWord(lowerWords[0]), ...lowerWords.slice(1)].join(' ');
    case 'camel':
      return [lowerWords[0], ...capitalizedWords.slice(1)].join('');
    case 'pascal':
      return capitalizedWords.join('');
    case 'snake':
      return lowerWords.join('_');
    case 'kebab':
      return lowerWords.join('-');
    case 'constant':
      return lowerWords.join('_').toLocaleUpperCase();
  }
}

export function normalizeText(input: string, options: NormalizeTextOptions = {}): string {
  let lines = input.replace(/\r\n?/g, '\n').split('\n');
  if (options.collapseInlineWhitespace) {
    lines = lines.map((line) => line.replace(/[^\S\n]+/g, ' '));
  }
  if (options.trimLines) lines = lines.map((line) => line.trim());
  if (options.removeEmptyLines) lines = lines.filter((line) => line.length > 0);

  let output = lines.join('\n');
  if (options.collapseBlankLines) output = output.replace(/\n{3,}/g, '\n\n');
  if (options.trimDocument) output = output.trim();
  return output;
}

export const STRUCTURED_FORMAT_TOOL_LIST: StructuredFormatTool[] = [
  {
    id: 'json-sort-keys',
    name: 'Sort JSON keys',
    description: 'Parse JSON, recursively sort object keys, and return formatted JSON.',
    category: 'data',
    keywords: ['json', 'sort', 'keys', 'canonical'],
    run: (input) => {
      const parsed = parseJsonOrThrow(input);
      return JSON.stringify(sortJsonKeys(parsed), null, 2);
    },
  },
  {
    id: 'json-pointer',
    name: 'Read JSON Pointer',
    description: 'Read one value from JSON using an RFC 6901 JSON Pointer.',
    category: 'data',
    keywords: ['json', 'pointer', 'query', 'extract'],
    optionsSchema: {
      type: 'object',
      required: ['pointer'],
      properties: { pointer: { type: 'string' } },
      additionalProperties: false,
    },
    run: (input, options) => {
      const pointer = readStringOption(options, 'pointer', '');
      const result = getJsonPointer(parseJsonOrThrow(input), pointer);
      if (!result.found) throw new Error(`JSON Pointer not found: ${pointer}`);
      return JSON.stringify(result.value, null, 2);
    },
  },
  {
    id: 'text-case',
    name: 'Convert text case',
    description:
      'Convert text to upper, lower, title, sentence, camel, Pascal, snake, kebab, or constant case.',
    category: 'text',
    keywords: ['text', 'case', 'camel', 'snake', 'kebab'],
    optionsSchema: {
      type: 'object',
      required: ['case'],
      properties: {
        case: {
          type: 'string',
          enum: [
            'upper',
            'lower',
            'title',
            'sentence',
            'camel',
            'pascal',
            'snake',
            'kebab',
            'constant',
          ],
        },
      },
      additionalProperties: false,
    },
    run: (input, options) => convertTextCase(input, readTextCase(options?.case)),
  },
  {
    id: 'text-normalize',
    name: 'Normalize text whitespace',
    description: 'Normalize line endings and optionally trim or collapse whitespace.',
    category: 'text',
    keywords: ['text', 'whitespace', 'normalize', 'lines'],
    optionsSchema: {
      type: 'object',
      properties: {
        trimLines: { type: 'boolean' },
        trimDocument: { type: 'boolean' },
        collapseBlankLines: { type: 'boolean' },
        collapseInlineWhitespace: { type: 'boolean' },
        removeEmptyLines: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    run: (input, options) =>
      normalizeText(input, {
        trimLines: readBooleanOption(options, 'trimLines'),
        trimDocument: readBooleanOption(options, 'trimDocument'),
        collapseBlankLines: readBooleanOption(options, 'collapseBlankLines'),
        collapseInlineWhitespace: readBooleanOption(options, 'collapseInlineWhitespace'),
        removeEmptyLines: readBooleanOption(options, 'removeEmptyLines'),
      }),
  },
];

export function getStructuredFormatToolById(id: string) {
  return STRUCTURED_FORMAT_TOOL_LIST.find((tool) => tool.id === id);
}

export async function runStructuredFormatTool(params: {
  toolId: string;
  input: string;
  options?: Record<string, unknown>;
}): Promise<StructuredFormatToolResult> {
  const tool = getStructuredFormatToolById(params.toolId);
  if (!tool) return { ok: false, output: '', error: 'Structured format tool not found.' };

  try {
    return { ok: true, output: await tool.run(params.input, params.options) };
  } catch (error) {
    return {
      ok: false,
      output: '',
      error: error instanceof Error ? error.message : 'Format tool failed.',
    };
  }
}

function parseJsonOrThrow(input: string): JsonValue {
  const result = parseJsonDocument(input);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function tokenizeWords(input: string): string[] {
  const separated = input.replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2');
  return separated.match(/[\p{L}\p{N}]+/gu) ?? [];
}

function capitalizeWord(word: string) {
  const [first = '', ...rest] = Array.from(word);
  return `${first.toLocaleUpperCase()}${rest.join('')}`;
}

function readTextCase(value: unknown): TextCase {
  const supported: TextCase[] = [
    'upper',
    'lower',
    'title',
    'sentence',
    'camel',
    'pascal',
    'snake',
    'kebab',
    'constant',
  ];
  if (typeof value === 'string' && supported.includes(value as TextCase)) return value as TextCase;
  return 'camel';
}

function readStringOption(
  options: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
) {
  const value = options?.[key];
  return typeof value === 'string' ? value : fallback;
}

function readBooleanOption(options: Record<string, unknown> | undefined, key: string) {
  return options?.[key] === true;
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

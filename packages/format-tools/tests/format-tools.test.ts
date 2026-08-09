import { describe, expect, it } from 'vitest';
import {
  convertTextCase,
  getFormatToolManifest,
  getJsonPointer,
  normalizeText,
  parseJsonDocument,
  runFormatTool,
  sortJsonKeys,
} from '../src/index';

describe('structured JSON tools', () => {
  it('returns a discriminated parse result without throwing', () => {
    expect(parseJsonDocument('{"enabled":true}')).toEqual({
      ok: true,
      value: { enabled: true },
    });

    const invalid = parseJsonDocument('{"enabled":}');
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error).not.toBe('');
  });

  it('sorts object keys recursively without reordering arrays', () => {
    expect(sortJsonKeys({ z: 1, a: { d: 4, b: 2 }, list: [{ y: 2, x: 1 }] })).toEqual({
      a: { b: 2, d: 4 },
      list: [{ x: 1, y: 2 }],
      z: 1,
    });
  });

  it('reads nested values through RFC 6901 JSON Pointers', () => {
    expect(getJsonPointer({ 'a/b': { '~key': ['first', 'second'] } }, '/a~1b/~0key/1')).toEqual({
      found: true,
      value: 'second',
    });
    expect(getJsonPointer({ list: [] }, '/list/0')).toEqual({ found: false });
  });

  it('runs JSON key sorting through the converter seam', async () => {
    await expect(
      runFormatTool({
        toolId: 'json-sort-keys',
        input: '{"z":1,"a":{"d":4,"b":2}}',
      }),
    ).resolves.toEqual({
      ok: true,
      output: '{\n  "a": {\n    "b": 2,\n    "d": 4\n  },\n  "z": 1\n}',
    });
  });
});

describe('text conversion tools', () => {
  it('converts words into common naming styles', () => {
    expect(convertTextCase('helloWorld JSON tools', 'snake')).toBe('hello_world_json_tools');
    expect(convertTextCase('hello-world tools', 'camel')).toBe('helloWorldTools');
    expect(convertTextCase('hello-world tools', 'pascal')).toBe('HelloWorldTools');
    expect(convertTextCase('hello-world tools', 'constant')).toBe('HELLO_WORLD_TOOLS');
  });

  it('normalizes line endings, surrounding whitespace, and repeated blank lines', () => {
    expect(
      normalizeText('  first  \r\n\r\n\r\n second\t value  ', {
        trimLines: true,
        collapseBlankLines: true,
        collapseInlineWhitespace: true,
      }),
    ).toBe('first\n\nsecond value');
  });

  it('reports useful text statistics', async () => {
    const result = await runFormatTool({
      toolId: 'text-statistics',
      input: 'Hello Valley\n你好 Valley',
    });

    expect(result.ok).toBe(true);
    expect(JSON.parse(result.output)).toMatchObject({
      characters: 22,
      charactersWithoutSpaces: 19,
      lines: 2,
      words: 4,
    });
  });
});

describe('tabular and URL tools', () => {
  it('converts CSV and JSON in both directions', async () => {
    await expect(
      runFormatTool({
        toolId: 'csv-json',
        input: 'name,note\nValley,"hello, world"',
      }),
    ).resolves.toEqual({
      ok: true,
      output: '[\n  {\n    "name": "Valley",\n    "note": "hello, world"\n  }\n]',
    });

    const reverse = await runFormatTool({
      toolId: 'csv-json',
      direction: 'reverse',
      input: '[{"name":"Valley","note":"hello, world"}]',
    });
    expect(reverse).toEqual({ ok: true, output: 'name,note\nValley,"hello, world"' });
  });

  it('converts JSON Lines and JSON arrays in both directions', async () => {
    await expect(
      runFormatTool({ toolId: 'jsonl-json', input: '{"id":1}\n{"id":2}' }),
    ).resolves.toEqual({
      ok: true,
      output: '[\n  {\n    "id": 1\n  },\n  {\n    "id": 2\n  }\n]',
    });
    await expect(
      runFormatTool({ toolId: 'jsonl-json', direction: 'reverse', input: '[{"id":1},{"id":2}]' }),
    ).resolves.toEqual({ ok: true, output: '{"id":1}\n{"id":2}' });
  });

  it('parses a URL into stable structured fields', async () => {
    const result = await runFormatTool({
      toolId: 'url-inspect',
      input: 'https://example.com:8443/docs?q=valley&q=tools#intro',
    });

    expect(result.ok).toBe(true);
    expect(JSON.parse(result.output)).toMatchObject({
      protocol: 'https:',
      hostname: 'example.com',
      port: '8443',
      pathname: '/docs',
      hash: '#intro',
      query: { q: ['valley', 'tools'] },
    });
  });
});

describe('agent-ready format tool manifest', () => {
  it('describes the stable converter runner without exposing functions', () => {
    const manifest = getFormatToolManifest();

    expect(manifest.name).toBe('format.convert');
    expect(manifest.converters.some((converter) => converter.id === 'json-format')).toBe(true);
    expect(manifest.converters.some((converter) => converter.id === 'csv-json')).toBe(true);
    expect(manifest.inputSchema.properties.toolId.enum).toContain('json-sort-keys');
    expect(manifest.converters.find((converter) => converter.id === 'text-case')).toMatchObject({
      optionsSchema: { required: ['case'] },
    });
    expect(() => JSON.stringify(manifest)).not.toThrow();
  });

  it('executes option-bearing text tools through the stable runner', async () => {
    await expect(
      runFormatTool({
        toolId: 'text-case',
        input: 'Valley native tools',
        options: { case: 'kebab' },
      }),
    ).resolves.toEqual({ ok: true, output: 'valley-native-tools' });
  });
});

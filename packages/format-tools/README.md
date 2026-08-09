# `@valley/format-tools`

Dependency-free text, encoding, structured-data, tabular-data, URL, date, hash, and utility functions that work in browsers and modern Node runtimes.

The converter catalog includes JSON/XML formatting, CSV ↔ JSON, JSON Lines ↔ JSON, URL inspection, query-string conversion, Base64 and Unicode codecs, date conversion, line tools, text statistics, hashes, and JWT inspection.

## Structured helpers

The package exports non-throwing JSON parsing, recursive JSON key sorting, RFC 6901 JSON Pointer lookup, common text-case conversion, and configurable whitespace normalization.

```ts
import {
  convertTextCase,
  parseJsonDocument,
  sortJsonKeys,
} from '@valley/format-tools';

const parsed = parseJsonDocument('{"z":1,"a":2}');
if (parsed.ok) {
  console.log(sortJsonKeys(parsed.value));
}

convertTextCase('Valley native tools', 'kebab');
```

## Tool-host integration

`getFormatToolManifest()` returns the JSON-serializable `format.convert` tool description. `runFormatTool()` executes both the existing format converters and the structured tools through one stable interface.

```ts
const result = await runFormatTool({
  toolId: 'text-case',
  input: 'Valley native tools',
  options: { case: 'snake' },
});
```

`FORMAT_CONVERTER_LIST` is the curated catalog used by the Web tool page. Structured tools remain a separate list, and consumers can combine either list with the same stable runner.

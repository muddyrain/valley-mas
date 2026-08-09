# `@valley/format-tools`

Dependency-free text, encoding, structured-data, date, hash, and utility functions that work in browsers and modern Node runtimes.

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

The existing `FORMAT_CONVERTER_LIST` remains the Web page's curated UI list. Structured tools are separate so package growth does not silently change a product page; a page can opt in when its UX is ready.

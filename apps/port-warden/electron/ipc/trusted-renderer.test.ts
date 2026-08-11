import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isTrustedRendererUrl } from './trusted-renderer';

describe('trusted renderer URL', () => {
  const productionEntry = path.resolve('/Applications/Port Warden/resources/app/dist/index.html');

  it('allows only the fixed development origin in development', () => {
    expect(isTrustedRendererUrl('http://127.0.0.1:5182/', true, productionEntry)).toBe(true);
    expect(isTrustedRendererUrl('http://127.0.0.1:5182/?debug=1', true, productionEntry)).toBe(
      true,
    );
    expect(isTrustedRendererUrl('http://localhost:5182/', true, productionEntry)).toBe(false);
    expect(isTrustedRendererUrl('https://example.com/', true, productionEntry)).toBe(false);
  });

  it('allows only the exact packaged entry in production', () => {
    expect(isTrustedRendererUrl(pathToFileURL(productionEntry).href, false, productionEntry)).toBe(
      true,
    );
    expect(
      isTrustedRendererUrl(
        pathToFileURL(path.resolve('/tmp/dist/index.html')).href,
        false,
        productionEntry,
      ),
    ).toBe(false);
    expect(isTrustedRendererUrl('https://example.com/', false, productionEntry)).toBe(false);
    expect(isTrustedRendererUrl('not a url', false, productionEntry)).toBe(false);
  });
});
